import type { ProcessorJobSpec } from "@klipse/video-assembly-shared"

import { BoundedSet } from "../utils/bounded-set"
import { logger } from "../utils/logger"
import { executeJob } from "./executor"

/** Jobs currently being processed or queued. Cleared when pipeline finishes. */
const activeSpecJobIds = new Set<string>()
/**
 * Terminal jobs — prevents duplicate processing on replayed requests.
 * BoundedSet caps at 2000 entries to avoid memory growth on long-lived instances.
 */
const finishedSpecJobIds = new BoundedSet(2_000)

const specQueue: ProcessorJobSpec[] = []
let specPumpScheduled = false

function finalizeSpecJob(jobId: string): void {
	activeSpecJobIds.delete(jobId)
	finishedSpecJobIds.add(jobId)
}

async function pumpSpecQueue(): Promise<void> {
	while (specQueue.length > 0) {
		const spec = specQueue.shift()
		if (!spec) break
		try {
			await executeJob(spec)
		} catch (e) {
			logger.error("runner_unhandled_job_error", {
				jobId: spec.jobId,
				error: e instanceof Error ? e.message : String(e),
			})
		} finally {
			finalizeSpecJob(spec.jobId)
		}
	}
}

function scheduleSpecPump(): void {
	if (specPumpScheduled) return
	specPumpScheduled = true
	void (async () => {
		try {
			await pumpSpecQueue()
		} finally {
			specPumpScheduled = false
			if (specQueue.length > 0) scheduleSpecPump()
		}
	})()
}

/** Idempotent: returns false if job is already active/finished (replay). */
export function enqueueSpecJob(spec: ProcessorJobSpec): boolean {
	if (finishedSpecJobIds.has(spec.jobId)) return false
	if (activeSpecJobIds.has(spec.jobId)) return false
	activeSpecJobIds.add(spec.jobId)
	specQueue.push(spec)
	scheduleSpecPump()
	return true
}

export function isSpecJobKnown(jobId: string): boolean {
	return activeSpecJobIds.has(jobId) || finishedSpecJobIds.has(jobId)
}
