import "@tanstack/react-start/server-only"

import { planAllowsPaidPublishingConnections } from "@/features/billing/tier-config"
import type { ChannelRow } from "@/features/channels/channels.service.server"
import type { MeResponse } from "@/features/user/types/me"
import { logger } from "@/lib/logger"

import { requestPlatformPublishForJob } from "./request-platform-publish.server"

/**
 * Platform-agnostic auto-post dispatcher called after a video render completes.
 * Guards: plan must allow paid publishing connections, channel must be OAuth-connected,
 * and `auto_post` must be enabled. Add new platform branches here as they launch.
 */
export async function dispatchPlatformPublishAfterRender(input: {
	jobId: string
	userId: string
	channel: ChannelRow
	plan: MeResponse["plan"]
}): Promise<void> {
	if (!planAllowsPaidPublishingConnections(input.plan)) return
	if (!input.channel.oauthConnected) return
	if (!input.channel.config.auto_post) return

	switch (input.channel.platform) {
		case "youtube":
			await requestPlatformPublishForJob({
				jobId: input.jobId,
				userId: input.userId,
				platform: "youtube",
			})
			return
		case "tiktok":
			await requestPlatformPublishForJob({
				jobId: input.jobId,
				userId: input.userId,
				platform: "tiktok",
			})
			return
		case "instagram":
			// OAuth + upload not yet implemented.
			logger.warn("publish_platform_not_implemented", {
				platform: input.channel.platform,
				jobId: input.jobId,
			})
			return
		case "unlinked":
			return
	}
}
