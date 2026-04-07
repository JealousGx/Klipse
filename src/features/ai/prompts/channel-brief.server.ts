import "@tanstack/react-start/server-only";

import type { ChannelRow } from "@/features/channels/channels.service.server";

import type { ChannelCreativeBrief } from "./creative-brief.types";
import { publishingSurfaceLabel } from "./video-format-surface";

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
		aspectRatio: channel.config.aspect_ratio,
		publishingSurfaceLabel: publishingSurfaceLabel(channel.config.target_duration),
		destinationDisplayName:
			channel.externalChannelTitle?.trim() || channel.name,
	};
}
