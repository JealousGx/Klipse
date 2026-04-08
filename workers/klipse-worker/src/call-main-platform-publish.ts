import type { PlatformPublishMessage } from "@klipse/worker-contracts";

import type { Env } from "./env";

function trimTrailingSlash(url: string): string {
	return url.replace(/\/+$/, "");
}

/**
 * Worker → main app: upload a completed job's rendered video to a publishing platform.
 * The main-app endpoint is platform-specific; add a new `case` here as platforms land.
 */
export async function callMainAppPlatformPublish(
	env: Env,
	msg: PlatformPublishMessage,
): Promise<void> {
	const base = trimTrailingSlash(env.MAIN_APP_URL);

	// Route to the platform-specific internal handler.
	let path: string;
	switch (msg.platform) {
		case "youtube":
			path = "/api/internal/worker/youtube-publish";
			break;
		case "tiktok":
		case "instagram":
			// Not yet implemented — log and skip so the queue message does not retry.
			console.info(
				"[platform-publish] platform not yet implemented, skipping",
				msg.platform,
				msg.jobId,
			);
			return;
		default: {
			// Exhaustive check — TypeScript will error if a platform is added to the union
			// without being handled above.
			const _exhaustive: never = msg.platform;
			console.error(
				"[platform-publish] unknown platform",
				_exhaustive,
				msg.jobId,
			);
			return;
		}
	}

	const res = await fetch(`${base}${path}`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${env.WORKER_SECRET}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ jobId: msg.jobId, userId: msg.userId }),
	});

	if (!res.ok) {
		const text = await res.text();
		throw new Error(`platform_publish:${msg.platform} ${res.status}: ${text}`);
	}
}
