import "@tanstack/react-start/server-only";

import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { videoJobs } from "@/db/schema/video-jobs";

import { isVideoAssemblyPipelineKind, PIPELINE_KIND } from "./pipeline-kind";
import { processContentPipelineJob } from "./process-content-pipeline.server";
import { processStubPipelineJob } from "./process-stub-pipeline.server";
import { processVideoAssemblyPipelineJob } from "./process-video-assemble.server";
import {
	handoffVideoAssemblyToExternalProcessor,
	isExternalVideoProcessorConfigured,
} from "./video-assembly-handoff.server";

export type DispatchVideoJobInput = {
	jobId: string;
	userId: string;
	pipelineKind: string;
};

/**
 * Worker (or inline fallback) calls this after a `video_jobs` row is committed.
 * Verifies ownership + kind, then runs the pipeline handler. Safe to retry: no-op
 * if the job is already terminal.
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
		case PIPELINE_KIND.STUB_PIPELINE:
			await processStubPipelineJob(jobId);
			return;
		case PIPELINE_KIND.CONTENT_PIPELINE_V1:
			await processContentPipelineJob(jobId);
			return;
		default:
			if (isVideoAssemblyPipelineKind(row.pipelineKind)) {
				if (isExternalVideoProcessorConfigured()) {
					await handoffVideoAssemblyToExternalProcessor(jobId);
				} else {
					await processVideoAssemblyPipelineJob(jobId);
				}
				return;
			}
			throw new Error(`unsupported_pipeline_kind:${row.pipelineKind}`);
	}
}
