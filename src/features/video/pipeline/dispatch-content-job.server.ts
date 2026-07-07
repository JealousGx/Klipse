import "@tanstack/react-start/server-only"

import { and, eq, or } from "drizzle-orm"
import { getDb } from "@/db"
import { videoJobs } from "@/db/schema/video-jobs"
import { mysqlAffectedRowsFromUpdateResult } from "@/lib/db/mysql-affected-rows.server"
import { logger } from "@/lib/logger"
import { withPerfTiming } from "@/lib/perf-timing"
import {
	isProcessorJobConfigured,
	runProcessorJob,
} from "@/lib/video-processor/trigger-processor-job.server"

import { PIPELINE_STAGE } from "./pipeline-kind"
import { markVideoJobFailed } from "./process-stub-pipeline.server"

export const isContentProcessorConfigured = isProcessorJobConfigured

/**
 * Dispatches a content_pipeline_v1 job to the external processor (Cloud Run Job).
 * Transitions: queued → dispatched (status) / dispatch_pending (stage) → triggers a
 * Cloud Run Job execution (jobId only — the Job container pulls its own full spec from
 * `/api/internal/processor/job-spec`) → processing / script.
 * The processor handles: script → single-call video+audio generation → watermark →
 * R2 upload → callback.
 *
 * Also re-dispatches if job is stuck in dispatched + dispatch_pending (crash between
 * the CAS claim and triggering the Job execution).
 */
export async function dispatchContentJob(jobId: string): Promise<void> {
	const db = getDb()
	const id = jobId.trim()

	// Claim: queued → dispatched/dispatch_pending.
	// Also covers the crash-recovery case: dispatched + dispatch_pending (the Job trigger
	// call never reached GCP) — re-sets updatedAt so the row appears active.
	const claim = await db
		.update(videoJobs)
		.set({
			status: "dispatched",
			progress: 5,
			currentStage: PIPELINE_STAGE.DISPATCH_PENDING,
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(videoJobs.id, id),
				or(
					eq(videoJobs.status, "queued"),
					and(
						eq(videoJobs.status, "dispatched"),
						eq(videoJobs.currentStage, PIPELINE_STAGE.DISPATCH_PENDING),
					),
				),
			),
		)

	if (mysqlAffectedRowsFromUpdateResult(claim) === 0) {
		logger.info("job_dispatch_cas_skip", {
			jobId: id,
			reason: "already_dispatched_or_terminal",
		})
		return
	}

	if (!isProcessorJobConfigured()) {
		logger.error("[dispatch-content-job] processor job not configured", {
			jobId: id,
		})
		await markVideoJobFailed({
			jobId: id,
			message: "processor_job_not_configured",
		})
		return
	}

	let executionName: string | null = null
	try {
		const result = await withPerfTiming(
			"dispatch.processor_job_run",
			{ jobId: id },
			() => runProcessorJob(id),
		)
		executionName = result.executionName
	} catch (e) {
		logger.error("[dispatch-content-job] processor job trigger failed", {
			jobId: id,
			error: e instanceof Error ? e.message : String(e),
		})
		await markVideoJobFailed({
			jobId: id,
			message:
				e instanceof Error
					? e.message.slice(0, 500)
					: "processor_job_trigger_failed",
		})
		return
	}

	await db
		.update(videoJobs)
		.set({
			status: "processing",
			progress: 10,
			currentStage: PIPELINE_STAGE.SCRIPT,
			processorExecutionName: executionName,
			updatedAt: new Date(),
		})
		.where(and(eq(videoJobs.id, id), eq(videoJobs.status, "dispatched")))

	logger.info("job_dispatched_to_processor", { jobId: id })
}
