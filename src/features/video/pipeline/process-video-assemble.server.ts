import "@tanstack/react-start/server-only";

import { execFile } from "node:child_process";
import { unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import {
	integrationPlaceholderFfmpegArgs,
	videoJobAssemblyOutputKey,
} from "@klipse/video-assembly-shared";

import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { videoJobs } from "@/db/schema/video-jobs";
import { putVideoToR2 } from "@/lib/storage/r2.server";
import { markFreeTierVideoConsumedIfNeeded } from "./free-tier-video-consumed.server";
import { isVideoAssemblyPipelineKind, PIPELINE_STAGE } from "./pipeline-kind";
import { markVideoJobFailed } from "./process-stub-pipeline.server";

const execFileAsync = promisify(execFile);

function ffmpegBinary(): string {
	return process.env.FFMPEG_PATH?.trim() || "ffmpeg";
}

/**
 * Inline fallback when `VIDEO_PROCESSOR_URL` is unset: placeholder encode → R2.
 */
export async function processVideoAssemblyPipelineJob(
	jobId: string,
): Promise<void> {
	const db = getDb();
	const id = jobId.trim();

	const [job] = await db
		.select({
			id: videoJobs.id,
			userId: videoJobs.userId,
			channelId: videoJobs.channelId,
			pipelineKind: videoJobs.pipelineKind,
			status: videoJobs.status,
		})
		.from(videoJobs)
		.where(eq(videoJobs.id, id))
		.limit(1);

	if (!job) {
		throw new Error("video_job_not_found");
	}
	if (!isVideoAssemblyPipelineKind(job.pipelineKind)) {
		throw new Error("video_job_pipeline_mismatch");
	}
	if (job.status === "completed" || job.status === "failed") {
		return;
	}

	const now = new Date();
	await db
		.update(videoJobs)
		.set({
			status: "processing",
			progress: 15,
			currentStage: PIPELINE_STAGE.ASSEMBLE,
			updatedAt: now,
		})
		.where(and(eq(videoJobs.id, id), eq(videoJobs.status, "queued")));

	const tmpOut = join(tmpdir(), `klipse-assembly-${id}.mp4`);

	try {
		await execFileAsync(
			ffmpegBinary(),
			integrationPlaceholderFfmpegArgs(tmpOut),
			{
				timeout: 120_000,
				maxBuffer: 10 * 1024 * 1024,
			},
		);

		const { readFile } = await import("node:fs/promises");
		const buf = await readFile(tmpOut);

		const key = videoJobAssemblyOutputKey(job.userId, id);
		const { publicUrl } = await putVideoToR2({ key, body: buf });

		await db
			.update(videoJobs)
			.set({
				status: "completed",
				progress: 100,
				currentStage: PIPELINE_STAGE.DONE,
				outputUrl: publicUrl,
				updatedAt: new Date(),
			})
			.where(eq(videoJobs.id, id));

		await markFreeTierVideoConsumedIfNeeded(job.userId);
	} catch (e) {
		const message = e instanceof Error ? e.message : "video_assembly_failed";
		console.error("[video-assembly]", e);
		await markVideoJobFailed({ jobId: id, message });
	} finally {
		try {
			await unlink(tmpOut);
		} catch {
			// ignore
		}
	}
}
