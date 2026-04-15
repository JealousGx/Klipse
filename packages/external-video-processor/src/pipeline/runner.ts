import type { ProcessorJobSpec } from "@klipse/video-assembly-shared";

import { executeJob } from "./executor";

/** Jobs currently being processed or queued. Cleared when pipeline finishes. */
const activeSpecJobIds = new Set<string>();
/** Terminal jobs (complete callback delivered). Prevents duplicate processing. */
const finishedSpecJobIds = new Set<string>();

const specQueue: ProcessorJobSpec[] = [];
let specPumpScheduled = false;

function finalizeSpecJob(jobId: string): void {
	activeSpecJobIds.delete(jobId);
	finishedSpecJobIds.add(jobId);
}

async function pumpSpecQueue(): Promise<void> {
	while (specQueue.length > 0) {
		const spec = specQueue.shift();
		if (!spec) break;
		try {
			await executeJob(spec);
		} catch (e) {
			console.error(
				"[runner] unhandled job error (executor should have caught this)",
				e,
			);
		} finally {
			finalizeSpecJob(spec.jobId);
		}
	}
}

function scheduleSpecPump(): void {
	if (specPumpScheduled) return;
	specPumpScheduled = true;
	void (async () => {
		try {
			await pumpSpecQueue();
		} finally {
			specPumpScheduled = false;
			if (specQueue.length > 0) scheduleSpecPump();
		}
	})();
}

/** Idempotent: returns false if job is already active/finished (replay). */
export function enqueueSpecJob(spec: ProcessorJobSpec): boolean {
	if (finishedSpecJobIds.has(spec.jobId)) return false;
	if (activeSpecJobIds.has(spec.jobId)) return false;
	activeSpecJobIds.add(spec.jobId);
	specQueue.push(spec);
	scheduleSpecPump();
	return true;
}

export function isSpecJobKnown(jobId: string): boolean {
	return activeSpecJobIds.has(jobId) || finishedSpecJobIds.has(jobId);
}
