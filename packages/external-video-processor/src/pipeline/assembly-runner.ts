import type { VideoProcessorHandoffPayload } from "@klipse/video-assembly-shared";

import { BoundedSet } from "../utils/bounded-set";
import { runAssemblyJob } from "./assembly";

/** Assembly-only jobs (video_assemble_v1): active/finished tracking for idempotency. */
const activeJobIds = new Set<string>();
/**
 * Finished jobs — prevents duplicate processing on replayed requests.
 * BoundedSet caps at 2000 entries to avoid memory growth on long-lived instances.
 */
const finishedJobIds = new BoundedSet(2_000);

const queue: VideoProcessorHandoffPayload[] = [];
let pumpScheduled = false;

function finalizeJob(jobId: string): void {
	activeJobIds.delete(jobId);
	finishedJobIds.add(jobId);
}

async function pumpQueue(webhookSecret: string): Promise<void> {
	while (queue.length > 0) {
		const payload = queue.shift();
		if (!payload) break;
		try {
			await runAssemblyJob(payload);
			await notifyApp(webhookSecret, payload, "completed");
		} catch (e) {
			const msg = e instanceof Error ? e.message.slice(0, 4000) : String(e);
			console.warn(`[assembly-runner] job ${payload.jobId} failed`, e);
			try {
				await notifyApp(webhookSecret, payload, "failed", msg);
			} catch (ne) {
				console.error(
					`[assembly-runner] CRITICAL: failure webhook failed for ${payload.jobId}`,
					ne,
				);
			}
		} finally {
			finalizeJob(payload.jobId);
		}
	}
}

async function notifyApp(
	secret: string,
	payload: VideoProcessorHandoffPayload,
	status: "completed" | "failed",
	error?: string,
): Promise<void> {
	const body = { jobId: payload.jobId, userId: payload.userId, status, error };
	const res = await fetch(payload.completeWebhookUrl, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${secret}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(body),
		signal: AbortSignal.timeout(60_000),
	});
	if (!res.ok) {
		const t = await res.text().catch(() => "");
		throw new Error(`webhook_${res.status}:${t.slice(0, 300)}`);
	}
}

function schedulePump(webhookSecret: string): void {
	if (pumpScheduled) return;
	pumpScheduled = true;
	void (async () => {
		try {
			await pumpQueue(webhookSecret);
		} finally {
			pumpScheduled = false;
			if (queue.length > 0) schedulePump(webhookSecret);
		}
	})();
}

/** Idempotent: returns false if job is already active/finished. */
export function enqueueAssemblyJob(
	payload: VideoProcessorHandoffPayload,
	webhookSecret: string,
): boolean {
	if (finishedJobIds.has(payload.jobId)) return false;
	if (activeJobIds.has(payload.jobId)) return false;
	activeJobIds.add(payload.jobId);
	queue.push(payload);
	schedulePump(webhookSecret);
	return true;
}

export function isAssemblyJobKnown(jobId: string): boolean {
	return activeJobIds.has(jobId) || finishedJobIds.has(jobId);
}
