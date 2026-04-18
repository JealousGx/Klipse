import "@tanstack/react-start/server-only";

import { runYoutubePublishForJob } from "@/features/publishing/youtube/run-youtube-publish-for-job.server";

/**
 * Trigger platform publish inline (no queue). Called after render completes.
 * YouTube upload runs synchronously within the webhook response window.
 */
export async function requestPlatformPublishForJob(input: {
	jobId: string;
	userId: string;
	platform: "youtube" | "tiktok" | "instagram";
}): Promise<void> {
	switch (input.platform) {
		case "youtube":
			await runYoutubePublishForJob({
				jobId: input.jobId.trim(),
				userId: input.userId.trim(),
			});
			return;
		case "tiktok":
		case "instagram":
			// Not yet implemented — log and skip.
			console.info(
				"[request-platform-publish] platform not yet implemented, skipping",
				input.platform,
				input.jobId,
			);
			return;
	}
}
