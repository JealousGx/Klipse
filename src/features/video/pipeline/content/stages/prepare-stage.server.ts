import "@tanstack/react-start/server-only";

import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import type { VideoJobArtifacts } from "@/db/schema/video-jobs";
import { videoJobs } from "@/db/schema/video-jobs";

import { getChannelForUser } from "@/features/channels/channels.service.server";

import { mysqlAffectedRowsFromUpdateResult } from "@/lib/db/mysql-affected-rows.server";
import {
	enqueueVideoJobDispatch,
	WorkerEnqueueFailedError,
} from "@/lib/worker/enqueue.server";

import { PIPELINE_KIND, PIPELINE_STAGE } from "../../pipeline-kind";
import { markVideoJobFailed } from "../../process-stub-pipeline.server";
import { resolvePrepareRefs } from "../prepare-assets.server";

/**
 * Prepare stage: generate TTS audio (uploaded to R2) + Pollinations image URLs, then queue assembly.
 */
export async function processContentPrepareStage(jobId: string): Promise<void> {
	const db = getDb();
	const id = jobId.trim();

	const [row] = await db
		.select({
			id: videoJobs.id,
			userId: videoJobs.userId,
			channelId: videoJobs.channelId,
			pipelineKind: videoJobs.pipelineKind,
			status: videoJobs.status,
			currentStage: videoJobs.currentStage,
			artifacts: videoJobs.artifacts,
		})
		.from(videoJobs)
		.where(eq(videoJobs.id, id))
		.limit(1);

	if (!row) {
		throw new Error("video_job_not_found");
	}
	if (row.pipelineKind !== PIPELINE_KIND.CONTENT_PIPELINE_V1) {
		throw new Error("video_job_pipeline_mismatch");
	}
	if (row.status === "completed" || row.status === "failed") {
		return;
	}

	const scriptText = row.artifacts?.scriptText?.trim();
	if (!scriptText) {
		await markVideoJobFailed({ jobId: id, message: "prepare_missing_script" });
		return;
	}

	// Recovery: prepare finished but enqueue to assembly failed.
	if (
		row.status === "processing" &&
		row.currentStage === PIPELINE_STAGE.PREPARE &&
		row.artifacts?.prepareRefs
	) {
		await finalizePrepareAndQueueAssembly({
			jobId: id,
			userId: row.userId,
			artifacts: row.artifacts,
		});
		return;
	}

	if (row.currentStage !== PIPELINE_STAGE.PREPARE) {
		return;
	}

	if (row.status === "dispatched") {
		return;
	}

	if (row.status === "processing" && !row.artifacts?.prepareRefs) {
		return;
	}

	if (row.status !== "queued") {
		return;
	}

	const claim = await db
		.update(videoJobs)
		.set({
			status: "processing",
			progress: 40,
			currentStage: PIPELINE_STAGE.PREPARE,
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(videoJobs.id, id),
				eq(videoJobs.status, "queued"),
				eq(videoJobs.currentStage, PIPELINE_STAGE.PREPARE),
			),
		);

	if (mysqlAffectedRowsFromUpdateResult(claim) === 0) {
		return;
	}

	const channel = await getChannelForUser(row.userId, row.channelId);
	if (!channel) {
		await markVideoJobFailed({ jobId: id, message: "channel_not_found" });
		return;
	}

	try {
		const prepareRefs = await resolvePrepareRefs({
			scriptMarkdown: scriptText,
			channel,
			userId: row.userId,
			jobId: id,
		});

		const artifacts: VideoJobArtifacts = {
			...(row.artifacts ?? {}),
			scriptText,
			prepareRefs,
		};

		await finalizePrepareAndQueueAssembly({
			jobId: id,
			userId: row.userId,
			artifacts,
		});
	} catch (e) {
		if (e instanceof WorkerEnqueueFailedError) {
			return;
		}
		const message =
			e instanceof Error ? e.message.slice(0, 500) : "prepare_assets_failed";
		console.error("[prepare-stage]", e);
		await markVideoJobFailed({ jobId: id, message });
	}
}

async function finalizePrepareAndQueueAssembly(input: {
	jobId: string;
	userId: string;
	artifacts: VideoJobArtifacts;
}): Promise<void> {
	const db = getDb();
	const id = input.jobId.trim();
	const now = new Date();
	const advanced = await db
		.update(videoJobs)
		.set({
			status: "queued",
			progress: 62,
			currentStage: PIPELINE_STAGE.ASSEMBLE,
			artifacts: input.artifacts,
			updatedAt: now,
		})
		.where(
			and(
				eq(videoJobs.id, id),
				eq(videoJobs.pipelineKind, PIPELINE_KIND.CONTENT_PIPELINE_V1),
				eq(videoJobs.currentStage, PIPELINE_STAGE.PREPARE),
			),
		);

	if (mysqlAffectedRowsFromUpdateResult(advanced) === 0) {
		return;
	}

	await enqueueVideoJobDispatch({
		jobId: id,
		userId: input.userId,
		pipelineKind: PIPELINE_KIND.CONTENT_PIPELINE_V1,
	});
}
