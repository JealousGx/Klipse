import "@tanstack/react-start/server-only";

import { planAllowsPaidPublishingConnections } from "@/features/billing/tier-config";
import type { ChannelRow } from "@/features/channels/channels.service.server";
import type { MeResponse } from "@/features/user/types/me";

import { requestYoutubePublishForJob } from "./request-youtube-publish.server";

/**
 * Auto-post path (§2.14 off): enqueue YouTube upload after render completes.
 */
export async function maybeEnqueueYoutubePublishAfterRender(input: {
	jobId: string;
	userId: string;
	channel: ChannelRow;
	plan: MeResponse["plan"];
}): Promise<void> {
	if (!planAllowsPaidPublishingConnections(input.plan)) {
		return;
	}
	if (input.channel.platform !== "youtube") {
		return;
	}
	if (!input.channel.oauthConnected) {
		return;
	}
	if (!input.channel.config.auto_post) {
		return;
	}

	await requestYoutubePublishForJob({
		jobId: input.jobId,
		userId: input.userId,
	});
}
