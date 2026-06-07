import "@tanstack/react-start/server-only"

import { runTiktokPublishForJob } from "@/features/publishing/tiktok/run-tiktok-publish-for-job.server"
import { runYoutubePublishForJob } from "@/features/publishing/youtube/run-youtube-publish-for-job.server"
import { logger } from "@/lib/logger"

/**
 * Trigger platform publish inline (no queue). Called after render completes.
 * YouTube upload runs synchronously within the webhook response window.
 */
export async function requestPlatformPublishForJob(input: {
	jobId: string
	userId: string
	platform: "youtube" | "tiktok" | "instagram"
}): Promise<void> {
	switch (input.platform) {
		case "youtube":
			await runYoutubePublishForJob({
				jobId: input.jobId.trim(),
				userId: input.userId.trim(),
			})
			return
		case "tiktok":
			await runTiktokPublishForJob({
				jobId: input.jobId.trim(),
				userId: input.userId.trim(),
			})
			return
		case "instagram":
			// Not yet implemented — log and skip.
			logger.warn("publish_platform_not_implemented", {
				platform: input.platform,
				jobId: input.jobId,
			})
			return
	}
}
