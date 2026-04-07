import type { YoutubePublishMessage } from "@klipse/worker-contracts";

import type { Env } from "./env";

function trimTrailingSlash(url: string): string {
	return url.replace(/\/+$/, "");
}

/**
 * Worker → main app: upload a completed job’s MP4 to YouTube (heavy work stays on Node).
 */
export async function callMainAppYoutubePublish(
	env: Env,
	msg: YoutubePublishMessage,
): Promise<void> {
	const base = trimTrailingSlash(env.MAIN_APP_URL);
	const url = `${base}/api/internal/worker/youtube-publish`;

	const res = await fetch(url, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${env.WORKER_SECRET}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			jobId: msg.jobId,
			userId: msg.userId,
		}),
	});

	if (!res.ok) {
		const text = await res.text();
		throw new Error(`main youtube_publish ${res.status}: ${text}`);
	}
}
