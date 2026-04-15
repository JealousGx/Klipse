import "@tanstack/react-start/server-only";

import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { videoJobs } from "@/db/schema/video-jobs";
import {
	dispatchContentJob,
	isContentProcessorConfigured,
} from "./dispatch-content-job.server";
import { PIPELINE_KIND } from "./pipeline-kind";
import { markVideoJobFailed } from "./process-stub-pipeline.server";

/**
 * Content pipeline entry point: dispatches the job to the external processor (Cloud Run).
 * The processor runs the full pipeline: script → TTS + images + sound → FFmpeg → R2 → callback.
 */
export async function processContentPipelineJob(jobId: string): Promise<void> {
	const db = getDb();
	const id = jobId.trim();

	const [row] = await db
		.select({ pipelineKind: videoJobs.pipelineKind, status: videoJobs.status })
		.from(videoJobs)
		.where(eq(videoJobs.id, id))
		.limit(1);

	if (!row) throw new Error("video_job_not_found");
	if (row.pipelineKind !== PIPELINE_KIND.CONTENT_PIPELINE_V1) {
		throw new Error("video_job_pipeline_mismatch");
	}
	if (row.status === "completed" || row.status === "failed") return;
	if (row.status !== "queued") return;

	if (!isContentProcessorConfigured()) {
		await markVideoJobFailed({
			jobId: id,
			message: "video_processor_not_configured",
		});
		return;
	}

	await dispatchContentJob(id);
}
