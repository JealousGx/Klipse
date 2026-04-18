import "@tanstack/react-start/server-only";

import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { videoJobs } from "@/db/schema/video-jobs";
import { logger } from "@/lib/logger";
import {
	dispatchContentJob,
	isContentProcessorConfigured,
} from "./dispatch-content-job.server";
import { PIPELINE_KIND, PIPELINE_STAGE } from "./pipeline-kind";
import { markVideoJobFailed } from "./process-stub-pipeline.server";

/**
 * Content pipeline entry point: dispatches the job to the external processor (Cloud Run).
 * The processor runs the full pipeline: script → TTS + images + sound → FFmpeg → R2 → callback.
 */
export async function processContentPipelineJob(jobId: string): Promise<void> {
	const db = getDb();
	const id = jobId.trim();

	const [row] = await db
		.select({
			pipelineKind: videoJobs.pipelineKind,
			status: videoJobs.status,
			currentStage: videoJobs.currentStage,
		})
		.from(videoJobs)
		.where(eq(videoJobs.id, id))
		.limit(1);

	if (!row) throw new Error("video_job_not_found");
	if (row.pipelineKind !== PIPELINE_KIND.CONTENT_PIPELINE_V1) {
		throw new Error("video_job_pipeline_mismatch");
	}
	if (row.status === "completed" || row.status === "failed") {
		logger.info("content_pipeline_skip_terminal", { jobId: id, jobStatus: row.status });
		return;
	}

	// Re-attempt dispatch if the job was claimed (status=dispatched) but the
	// spec POST never reached the processor (crash between CAS and fetch).
	const isStuckDispatch =
		row.status === "dispatched" &&
		row.currentStage === PIPELINE_STAGE.DISPATCH_PENDING;

	if (row.status !== "queued" && !isStuckDispatch) {
		logger.info("content_pipeline_skip_non_queued", { jobId: id, jobStatus: row.status });
		return;
	}

	if (!isContentProcessorConfigured()) {
		logger.error("content_pipeline_processor_not_configured", { jobId: id });
		await markVideoJobFailed({
			jobId: id,
			message: "video_processor_not_configured",
		});
		return;
	}

	logger.info("content_pipeline_dispatch", {
		jobId: id,
		isStuckDispatch,
	});
	await dispatchContentJob(id);
}
