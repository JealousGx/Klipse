import "@tanstack/react-start/server-only"

import { and, asc, desc, eq, inArray, lt } from "drizzle-orm"

import { getDb } from "@/db"
import { videoJobs } from "@/db/schema/video-jobs"
import { logger } from "@/lib/logger"
import { cancelProcessorExecution } from "@/lib/video-processor/cancel-processor-job.server"

import { PIPELINE_STAGE } from "./pipeline-kind"
import { markVideoJobFailed } from "./process-stub-pipeline.server"
import { dispatchPipelineForJob } from "./process-video-job-dispatch.server"

/**
 * How long a job can sit in status=dispatched / stage=dispatch_pending before we
 * consider it stuck and re-attempt dispatch (the Job trigger call never reached GCP, or
 * the process crashed between the CAS claim and the trigger call).
 */
const STUCK_DISPATCH_TIMEOUT_MS = 3 * 60 * 1000 // 3 minutes

/**
 * How long a job can sit in status=processing with no progress update before we presume
 * it stuck (GPU crashed, processor hung, callback lost) and fail it. This is a
 * presumption, not a confirmed failure — there's no way to know for certain without a
 * callback — but with only MAX_CONCURRENT_JOBS execution allowed, one stuck job would
 * otherwise block the queue forever. A real observed run: dispatched 8:34:55, completed
 * 8:40 (~5 min) — 30 min gives generous headroom above that without leaving the queue
 * blocked too long. We also actively cancel the underlying Cloud Run execution below so
 * this actually stops GPU billing, not just the DB row.
 */
const STUCK_PROCESSING_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes

/**
 * Cost guardrails: never trigger a new GPU (RTX Pro 6000) Cloud Run execution while one
 * is already in flight, and never trigger one within MIN_DISPATCH_GAP_MS of the last.
 */
const MAX_CONCURRENT_JOBS = 1
const MIN_DISPATCH_GAP_MS = 5 * 60 * 1000 // 5 minutes

const ACTIVE_STATUSES = ["dispatched", "processing"] as const

export type DispatchQueuedJobsResult = {
	dispatched: number
	errors: number
	timedOut: number
}

/**
 * Picks up at most one job per tick — a stuck `dispatched` job to retry, or a `queued`
 * job to start — and kicks off its pipeline. Called every minute by
 * `POST /api/cron/dispatch-queued-jobs`, but the actual dispatch rate is throttled well
 * below that cron cadence by MAX_CONCURRENT_JOBS / MIN_DISPATCH_GAP_MS below — the cron
 * cadence only bounds how quickly we notice it's safe to dispatch again.
 *
 * Idempotent: `dispatchPipelineForJob` guards against re-processing completed/failed jobs
 * and uses a status CAS to prevent concurrent dispatch races.
 */
export async function dispatchQueuedJobs(): Promise<DispatchQueuedJobsResult> {
	const db = getDb()
	const now = Date.now()
	let errors = 0

	// 1. Fail jobs stuck in `processing` past the stall timeout, cancelling their actual
	// GPU execution first — otherwise "failed" in the DB doesn't stop it from still
	// running (and billing) until GCP's own task_timeout kills it.
	const stuckProcessingCutoff = new Date(now - STUCK_PROCESSING_TIMEOUT_MS)
	const stuckProcessing = await db
		.select({
			id: videoJobs.id,
			processorExecutionName: videoJobs.processorExecutionName,
		})
		.from(videoJobs)
		.where(
			and(
				eq(videoJobs.status, "processing"),
				lt(videoJobs.updatedAt, stuckProcessingCutoff),
			),
		)

	for (const job of stuckProcessing) {
		logger.warn("job_processing_stall_timeout", {
			jobId: job.id,
			hasExecutionName: Boolean(job.processorExecutionName),
		})
		if (job.processorExecutionName) {
			await cancelProcessorExecution(job.processorExecutionName)
		}
		await markVideoJobFailed({
			jobId: job.id,
			message:
				"processor_stall_timeout: no progress reported in time; GPU execution cancelled",
		})
	}

	// 2. Re-dispatch a job stuck in dispatched/dispatch_pending (never picked up by the
	// processor) — this reuses the same execution slot, it isn't new concurrency.
	const stuckDispatchCutoff = new Date(now - STUCK_DISPATCH_TIMEOUT_MS)
	const [stuckDispatch] = await db
		.select({
			id: videoJobs.id,
			userId: videoJobs.userId,
			pipelineKind: videoJobs.pipelineKind,
		})
		.from(videoJobs)
		.where(
			and(
				eq(videoJobs.status, "dispatched"),
				eq(videoJobs.currentStage, PIPELINE_STAGE.DISPATCH_PENDING),
				lt(videoJobs.updatedAt, stuckDispatchCutoff),
			),
		)
		.limit(1)

	if (stuckDispatch) {
		logger.info("dispatch_queued_jobs_retry_stuck", { jobId: stuckDispatch.id })
		try {
			await dispatchPipelineForJob({
				jobId: stuckDispatch.id,
				userId: stuckDispatch.userId,
				pipelineKind: stuckDispatch.pipelineKind,
			})
			return { dispatched: 1, errors, timedOut: stuckProcessing.length }
		} catch (err) {
			logger.error("[dispatch-queued-jobs] stuck dispatch retry failed", {
				jobId: stuckDispatch.id,
				error: err instanceof Error ? err.message : String(err),
			})
			return {
				dispatched: 0,
				errors: errors + 1,
				timedOut: stuckProcessing.length,
			}
		}
	}

	// 3. Concurrency cap.
	const active = await db
		.select({ id: videoJobs.id })
		.from(videoJobs)
		.where(inArray(videoJobs.status, ACTIVE_STATUSES))
		.limit(MAX_CONCURRENT_JOBS)

	if (active.length >= MAX_CONCURRENT_JOBS) {
		logger.info("dispatch_queued_jobs_skip_concurrency", {
			activeCount: active.length,
		})
		return { dispatched: 0, errors, timedOut: stuckProcessing.length }
	}

	// 4. Minimum gap between dispatch starts. There's no dedicated "last dispatch"
	// timestamp — `updatedAt` on the most recently touched non-queued job already serves
	// as one, since the concurrency cap above guarantees we only reach here once the
	// last job hit a terminal state (its updatedAt is then its completion/failure time).
	const [lastActivity] = await db
		.select({ updatedAt: videoJobs.updatedAt })
		.from(videoJobs)
		.where(
			inArray(videoJobs.status, [...ACTIVE_STATUSES, "completed", "failed"]),
		)
		.orderBy(desc(videoJobs.updatedAt))
		.limit(1)

	if (lastActivity) {
		const msSinceLastActivity = now - lastActivity.updatedAt.getTime()
		if (msSinceLastActivity < MIN_DISPATCH_GAP_MS) {
			logger.info("dispatch_queued_jobs_skip_rate_limit", {
				msSinceLastActivity,
			})
			return { dispatched: 0, errors, timedOut: stuckProcessing.length }
		}
	}

	// 5. Dispatch the oldest queued job.
	const [job] = await db
		.select({
			id: videoJobs.id,
			userId: videoJobs.userId,
			pipelineKind: videoJobs.pipelineKind,
		})
		.from(videoJobs)
		.where(eq(videoJobs.status, "queued"))
		.orderBy(asc(videoJobs.createdAt))
		.limit(1)

	if (!job) {
		return { dispatched: 0, errors, timedOut: stuckProcessing.length }
	}

	let dispatched = 0
	try {
		await dispatchPipelineForJob({
			jobId: job.id,
			userId: job.userId,
			pipelineKind: job.pipelineKind,
		})
		dispatched = 1
	} catch (err) {
		logger.error("[dispatch-queued-jobs] dispatch failed", {
			jobId: job.id,
			error: err instanceof Error ? err.message : String(err),
		})
		errors++
	}

	logger.info("dispatch_queued_jobs_complete", {
		dispatched,
		errors,
		timedOut: stuckProcessing.length,
	})

	return { dispatched, errors, timedOut: stuckProcessing.length }
}
