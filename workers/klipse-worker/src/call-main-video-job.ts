import type { VideoJobDispatchMessage } from "@klipse/worker-contracts";

import { trimTrailingSlash } from "./call-main-drain";
import type { Env } from "./env";

/**
 * Worker → main app: execute pipeline for a queued `video_jobs` row.
 */
export async function callMainAppVideoJobDispatch(
	env: Env,
	msg: VideoJobDispatchMessage,
): Promise<void> {
	const base = trimTrailingSlash(env.MAIN_APP_URL);
	const url = `${base}/api/internal/worker/video-jobs/dispatch`;

	const res = await fetch(url, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${env.WORKER_SECRET}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			jobId: msg.jobId,
			userId: msg.userId,
			pipelineKind: msg.pipelineKind,
		}),
	});

	if (!res.ok) {
		const text = await res.text();
		throw new Error(`main video_job dispatch ${res.status}: ${text}`);
	}
}
