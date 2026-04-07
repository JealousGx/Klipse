import "@tanstack/react-start/server-only";

import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { videoJobs } from "@/db/schema/video-jobs";

import { processContentPrepareStage } from "./content/stages/prepare-stage.server";
import { processContentScriptStage } from "./content/stages/script-stage.server";
import { PIPELINE_KIND, PIPELINE_STAGE } from "./pipeline-kind";
import { markVideoJobFailed } from "./process-stub-pipeline.server";
import {
	handoffVideoAssemblyToExternalProcessor,
	isExternalVideoProcessorConfigured,
} from "./video-assembly-handoff.server";

/**
 * Modular content pipeline: {@link PIPELINE_STAGE.SCRIPT} → {@link PIPELINE_STAGE.PREPARE} → assemble.
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

	switch (row.currentStage) {
		case PIPELINE_STAGE.SCRIPT:
			await processContentScriptStage(id);
			return;
		case PIPELINE_STAGE.PREPARE:
			await processContentPrepareStage(id);
			return;
		case PIPELINE_STAGE.ASSEMBLE:
			if (!isExternalVideoProcessorConfigured()) {
				await markVideoJobFailed({
					jobId: id,
					message: "video_processor_not_configured",
				});
				return;
			}
			await handoffVideoAssemblyToExternalProcessor(id);
			return;
		default:
			return;
	}
}
