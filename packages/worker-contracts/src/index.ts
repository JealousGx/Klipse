/**
 * Shared queue / HTTP payloads between the TanStack app (producer) and Cloudflare Worker.
 * Add new job kinds here as the worker gains features.
 */
export const QUEUE_MESSAGE_KIND = {
	/**
	 * Dispatch a `video_jobs` row to the worker runtime. `pipelineKind` matches
	 * `video_jobs.pipeline_kind` — route on this, not on publishing platform.
	 */
	videoJobDispatch: "video_job_dispatch",
	/**
	 * Upload a completed render to a publishing platform (§2.12, §2.15).
	 * `platform` is the target; only `youtube` is wired today.
	 */
	platformPublish: "platform_publish",
} as const;

export type QueueMessageKind =
	(typeof QUEUE_MESSAGE_KIND)[keyof typeof QUEUE_MESSAGE_KIND];

export type VideoJobDispatchMessage = {
	kind: typeof QUEUE_MESSAGE_KIND.videoJobDispatch;
	jobId: string;
	pipelineKind: string;
	userId: string;
};

export type PlatformPublishMessage = {
	kind: typeof QUEUE_MESSAGE_KIND.platformPublish;
	jobId: string;
	userId: string;
	/** Publishing platform — determines which main-app endpoint the worker calls. */
	platform: "youtube" | "tiktok" | "instagram";
};

export type QueueMessage = VideoJobDispatchMessage | PlatformPublishMessage;

export function isQueueMessage(body: unknown): body is QueueMessage {
	if (typeof body !== "object" || body === null) {
		return false;
	}
	const k = (body as { kind?: unknown }).kind;

	if (k === QUEUE_MESSAGE_KIND.videoJobDispatch) {
		const o = body as Partial<VideoJobDispatchMessage>;
		return (
			typeof o.jobId === "string" &&
			typeof o.userId === "string" &&
			typeof o.pipelineKind === "string"
		);
	}

	if (k === QUEUE_MESSAGE_KIND.platformPublish) {
		const o = body as Partial<PlatformPublishMessage>;
		return (
			typeof o.jobId === "string" &&
			typeof o.userId === "string" &&
			(o.platform === "youtube" ||
				o.platform === "tiktok" ||
				o.platform === "instagram")
		);
	}

	return false;
}
