import "@tanstack/react-start/server-only";

import type { ChannelRow } from "@/features/channels/channels.service.server";

import type { ChannelCreativeBrief } from "./creative-brief.types";

/**
 * Neutral format descriptor for prompts — not a vendor or app name.
 * Stays stable as new publishing integrations are added.
 */
export const DEFAULT_PUBLISHING_SURFACE_LABEL =
	"Vertical short-form video (mobile-first, full-screen portrait)";

/** Same neutral label for all platforms; `platform` reserved for future format overrides. */
export function publishingSurfaceLabel(
	_platform: ChannelRow["platform"],
): string {
	return DEFAULT_PUBLISHING_SURFACE_LABEL;
}

/** Maps a loaded destination row + config into shared creative brief fields. */
export function channelToCreativeBrief(
	channel: ChannelRow,
): ChannelCreativeBrief {
	return {
		channelName: channel.name,
		niche: channel.niche,
		tone: channel.config.tone,
		targetSeconds: channel.config.target_duration,
		postingFrequency: channel.config.posting_frequency,
		captionStyle: channel.config.visual_identity.caption_style,
		fontPairLabel: channel.config.visual_identity.font_pair.join(" + "),
		primaryColorHex: channel.config.visual_identity.primary_color,
		publishingSurfaceLabel: publishingSurfaceLabel(channel.platform),
		destinationDisplayName:
			channel.externalChannelTitle?.trim() || channel.name,
	};
}
