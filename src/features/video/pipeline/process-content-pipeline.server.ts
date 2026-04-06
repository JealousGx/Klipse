import "@tanstack/react-start/server-only";

import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { videoJobs } from "@/db/schema/video-jobs";

import { PIPELINE_KIND, PIPELINE_STAGE } from "./pipeline-kind";
import { markVideoJobFailed } from "./process-stub-pipeline.server";
import { processScriptStage } from "./process-script-stage.server";
import {
	handoffVideoAssemblyToExternalProcessor,
	isExternalVideoProcessorConfigured,
} from "./video-assembly-handoff.server";

/**
 * Multi-stage content pipeline: script → assembly (external processor only).
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

	if (!row) {
		throw new Error("video_job_not_found");
	}
	if (row.pipelineKind !== PIPELINE_KIND.CONTENT_PIPELINE_V1) {
		throw new Error("video_job_pipeline_mismatch");
	}
	if (row.status === "completed" || row.status === "failed") {
		return;
	}

	if (row.currentStage === PIPELINE_STAGE.SCRIPT) {
		await processScriptStage(id);
		return;
	}

	if (row.currentStage === PIPELINE_STAGE.ASSEMBLE) {
		if (!isExternalVideoProcessorConfigured()) {
			await markVideoJobFailed({
				jobId: id,
				message: "video_processor_not_configured",
			});
			return;
		}
		await handoffVideoAssemblyToExternalProcessor(id);
		return;
	}
}
