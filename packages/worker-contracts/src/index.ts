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
	/** Main app uploads a completed render to YouTube (§2.12, §2.15 publishing queue). */
	youtubePublish: "youtube_publish",
} as const;

export type QueueMessageKind =
	(typeof QUEUE_MESSAGE_KIND)[keyof typeof QUEUE_MESSAGE_KIND];

export type VideoJobDispatchMessage = {
	kind: typeof QUEUE_MESSAGE_KIND.videoJobDispatch;
	jobId: string;
	pipelineKind: string;
	userId: string;
};

export type YoutubePublishMessage = {
	kind: typeof QUEUE_MESSAGE_KIND.youtubePublish;
	jobId: string;
	userId: string;
};

export type QueueMessage = VideoJobDispatchMessage | YoutubePublishMessage;

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
	if (k === QUEUE_MESSAGE_KIND.youtubePublish) {
		const o = body as Partial<YoutubePublishMessage>;
		return typeof o.jobId === "string" && typeof o.userId === "string";
	}
	return false;
}
