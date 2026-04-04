/**
 * Shared queue / HTTP payloads between the TanStack app (producer) and Cloudflare Worker.
 * Add new job kinds here as the worker gains features.
 */
export const QUEUE_MESSAGE_KIND = {
	polarUsageSyncDrain: "polar_usage_sync_drain",
} as const;

export type QueueMessageKind =
	(typeof QUEUE_MESSAGE_KIND)[keyof typeof QUEUE_MESSAGE_KIND];

export type PolarUsageSyncDrainMessage = {
	kind: typeof QUEUE_MESSAGE_KIND.polarUsageSyncDrain;
	/** Optional override; worker defaults are fine for most cases. */
	limit?: number;
};

export type QueueMessage = PolarUsageSyncDrainMessage;

export function isQueueMessage(body: unknown): body is QueueMessage {
	if (typeof body !== "object" || body === null) {
		return false;
	}
	const k = (body as { kind?: unknown }).kind;
	return k === QUEUE_MESSAGE_KIND.polarUsageSyncDrain;
}
