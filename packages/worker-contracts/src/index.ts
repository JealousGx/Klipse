/**
 * Shared queue / HTTP payloads between the TanStack app (producer) and Cloudflare Worker.
 * Add new job kinds here as the worker gains features.
 */
export const QUEUE_MESSAGE_KIND = {
	polarUsageSyncDrain: "polar_usage_sync_drain",
	/**
	 * Dispatch a `video_jobs` row to the worker runtime. `pipelineKind` matches
	 * `video_jobs.pipeline_kind` — route on this, not on publishing platform.
	 */
	videoJobDispatch: "video_job_dispatch",
} as const;

export type QueueMessageKind =
	(typeof QUEUE_MESSAGE_KIND)[keyof typeof QUEUE_MESSAGE_KIND];

export type PolarUsageSyncDrainMessage = {
	kind: typeof QUEUE_MESSAGE_KIND.polarUsageSyncDrain;
	/** Optional override; worker defaults are fine for most cases. */
	limit?: number;
};

export type VideoJobDispatchMessage = {
	kind: typeof QUEUE_MESSAGE_KIND.videoJobDispatch;
	jobId: string;
	pipelineKind: string;
	userId: string;
};

export type QueueMessage = PolarUsageSyncDrainMessage | VideoJobDispatchMessage;

export function isQueueMessage(body: unknown): body is QueueMessage {
	if (typeof body !== "object" || body === null) {
		return false;
	}
	const k = (body as { kind?: unknown }).kind;
	return (
		k === QUEUE_MESSAGE_KIND.polarUsageSyncDrain ||
		k === QUEUE_MESSAGE_KIND.videoJobDispatch
	);
}
