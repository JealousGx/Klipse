import "@tanstack/react-start/server-only";

import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { videoJobs } from "@/db/schema/video-jobs";

import { PIPELINE_KIND, PIPELINE_STAGE } from "./pipeline-kind";

/**
 * Advances a {@link PIPELINE_KIND.STUB_PIPELINE} job (Worker → main app dispatch, or
 * inline fallback when the Worker HTTP enqueue is unreachable).
 */
export async function processStubPipelineJob(jobId: string): Promise<void> {
	const db = getDb();
	const trimmed = jobId.trim();
	const [row] = await db
		.select({
			id: videoJobs.id,
			pipelineKind: videoJobs.pipelineKind,
			status: videoJobs.status,
		})
		.from(videoJobs)
		.where(eq(videoJobs.id, trimmed))
		.limit(1);

	if (!row) {
		throw new Error("video_job_not_found");
	}
	if (row.pipelineKind !== PIPELINE_KIND.STUB_PIPELINE) {
		throw new Error("video_job_pipeline_mismatch");
	}
	if (row.status === "completed" || row.status === "failed") {
		return;
	}

	const now = new Date();

	await db
		.update(videoJobs)
		.set({
			status: "processing",
			progress: 45,
			currentStage: PIPELINE_STAGE.STUB_RUN,
			updatedAt: now,
		})
		.where(and(eq(videoJobs.id, trimmed), eq(videoJobs.status, "queued")));

	await db
		.update(videoJobs)
		.set({
			status: "completed",
			progress: 100,
			currentStage: PIPELINE_STAGE.DONE,
			updatedAt: new Date(),
		})
		.where(and(eq(videoJobs.id, trimmed), eq(videoJobs.status, "processing")));
}

/**
 * If post-commit processing fails, surface a failed job instead of leaving it queued forever.
 */
export async function markVideoJobFailed(input: {
	jobId: string;
	message: string;
}): Promise<void> {
	const db = getDb();
	const msg = input.message.trim().slice(0, 4000);
	await db
		.update(videoJobs)
		.set({
			status: "failed",
			progress: 0,
			currentStage: "failed",
			errorMessage: msg || "Pipeline error",
			updatedAt: new Date(),
		})
		.where(eq(videoJobs.id, input.jobId.trim()));
}
