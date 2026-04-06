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

import { and, eq, isNull, or } from "drizzle-orm";

import { getDb } from "@/db";
import { videoJobs } from "@/db/schema/video-jobs";
import { mysqlAffectedRowsFromUpdateResult } from "@/lib/db/mysql-affected-rows.server";
import { putVideoToR2 } from "@/lib/storage/r2.server";
import { markFreeTierVideoConsumedIfNeeded } from "./free-tier-video-consumed.server";
import { runAfterVideoRenderComplete } from "./video-job-after-render.server";
import {
	isAssemblyEncodingPipelineKind,
	PIPELINE_KIND,
	PIPELINE_STAGE,
} from "./pipeline-kind";
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
			currentStage: videoJobs.currentStage,
		})
		.from(videoJobs)
		.where(eq(videoJobs.id, id))
		.limit(1);

	if (!job) {
		throw new Error("video_job_not_found");
	}
	if (!isAssemblyEncodingPipelineKind(job.pipelineKind)) {
		throw new Error("video_job_pipeline_mismatch");
	}
	if (job.status === "completed" || job.status === "failed") {
		return;
	}

	const isContent = job.pipelineKind === PIPELINE_KIND.CONTENT_PIPELINE_V1;
	const assemblyRowReady =
		job.status === "queued" &&
		(isContent
			? job.currentStage === PIPELINE_STAGE.ASSEMBLE
			: job.currentStage === PIPELINE_STAGE.QUEUED ||
				job.currentStage === null);

	if (!assemblyRowReady) {
		return;
	}

	const now = new Date();
	const stagePredicate = isContent
		? eq(videoJobs.currentStage, PIPELINE_STAGE.ASSEMBLE)
		: or(
				eq(videoJobs.currentStage, PIPELINE_STAGE.QUEUED),
				isNull(videoJobs.currentStage),
			);

	const started = await db
		.update(videoJobs)
		.set({
			status: "processing",
			progress: 15,
			currentStage: PIPELINE_STAGE.ASSEMBLE,
			updatedAt: now,
		})
		.where(
			and(eq(videoJobs.id, id), eq(videoJobs.status, "queued"), stagePredicate),
		);

	if (mysqlAffectedRowsFromUpdateResult(started) === 0) {
		return;
	}

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

		await runAfterVideoRenderComplete({
			jobId: id,
			userId: job.userId,
			channelId: job.channelId,
			logicalKey: key,
		});
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
