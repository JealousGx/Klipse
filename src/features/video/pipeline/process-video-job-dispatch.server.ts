import "@tanstack/react-start/server-only";

import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { videoJobs } from "@/db/schema/video-jobs";

import { captureException } from "@/lib/sentry";
import { PIPELINE_KIND } from "./pipeline-kind";
import { processContentPipelineJob } from "./process-content-pipeline.server";

export type DispatchVideoJobInput = {
	jobId: string;
	userId: string;
	pipelineKind: string;
};

/**
 * Cron dispatch calls this for each queued job. Verifies ownership + kind,
 * then runs the pipeline handler. Safe to retry: no-op if already terminal.
 */
export async function dispatchPipelineForJob(
	input: DispatchVideoJobInput,
): Promise<void> {
	const db = getDb();
	const jobId = input.jobId.trim();
	const userId = input.userId.trim();

	const [row] = await db
		.select({
			userId: videoJobs.userId,
			pipelineKind: videoJobs.pipelineKind,
			status: videoJobs.status,
		})
		.from(videoJobs)
		.where(eq(videoJobs.id, jobId))
		.limit(1);

	if (!row) {
		throw new Error("video_job_not_found");
	}
	if (row.userId !== userId) {
		throw new Error("video_job_user_mismatch");
	}
	if (row.pipelineKind !== input.pipelineKind.trim()) {
		throw new Error("video_job_pipeline_kind_mismatch");
	}

	if (row.status === "completed" || row.status === "failed") {
		return;
	}

	switch (row.pipelineKind) {
		case PIPELINE_KIND.CONTENT_PIPELINE_V1:
			await processContentPipelineJob(jobId);
			return;
		default:
			captureException(
				new Error(`unsupported_pipeline_kind:${row.pipelineKind}`),
				{ jobId, userId, pipelineKind: row.pipelineKind },
			);
			throw new Error(`unsupported_pipeline_kind:${row.pipelineKind}`);
	}
}
