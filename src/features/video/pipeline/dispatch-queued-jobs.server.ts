import "@tanstack/react-start/server-only"

import { and, eq, lt, or } from "drizzle-orm"

import { getDb } from "@/db"
import { videoJobs } from "@/db/schema/video-jobs"
import { logger } from "@/lib/logger"

import { PIPELINE_STAGE } from "./pipeline-kind"
import { dispatchPipelineForJob } from "./process-video-job-dispatch.server"

/**
 * How long a job can sit in status=dispatched / stage=dispatch_pending before
 * we consider it stuck and re-attempt dispatch.
 */
const STUCK_DISPATCH_TIMEOUT_MS = 3 * 60 * 1000 // 3 minutes

/**
 * Safety cap: max jobs dispatched per cron tick to avoid overloading the processor.
 * Cron fires every 1 minute, so at most 10 jobs/min per instance.
 */
const MAX_DISPATCH_PER_TICK = 10

export type DispatchQueuedJobsResult = {
	dispatched: number
	errors: number
}

/**
 * Picks up all `queued` video jobs (and stuck `dispatched` ones) and kicks off
 * their pipelines. Called every minute by `POST /api/cron/dispatch-queued-jobs`.
 *
 * Idempotent: `dispatchPipelineForJob` guards against re-processing completed/failed jobs
 * and uses a status CAS to prevent concurrent dispatch races.
 */
export async function dispatchQueuedJobs(): Promise<DispatchQueuedJobsResult> {
	const db = getDb()
	const stuckCutoff = new Date(Date.now() - STUCK_DISPATCH_TIMEOUT_MS)

	const jobs = await db
		.select({
			id: videoJobs.id,
			userId: videoJobs.userId,
			pipelineKind: videoJobs.pipelineKind,
		})
		.from(videoJobs)
		.where(
			or(
				eq(videoJobs.status, "queued"),
				and(
					eq(videoJobs.status, "dispatched"),
					eq(videoJobs.currentStage, PIPELINE_STAGE.DISPATCH_PENDING),
					lt(videoJobs.updatedAt, stuckCutoff),
				),
			),
		)
		.limit(MAX_DISPATCH_PER_TICK)

	logger.info("dispatch_queued_jobs_picked_up", { count: jobs.length })

	let dispatched = 0
	let errors = 0

	for (const job of jobs) {
		try {
			await dispatchPipelineForJob({
				jobId: job.id,
				userId: job.userId,
				pipelineKind: job.pipelineKind,
			})
			dispatched++
		} catch (err) {
			logger.error("[dispatch-queued-jobs] dispatch failed", {
				jobId: job.id,
				error: err instanceof Error ? err.message : String(err),
			})
			errors++
		}
	}

	logger.info("dispatch_queued_jobs_complete", { dispatched, errors })

	return { dispatched, errors }
}
