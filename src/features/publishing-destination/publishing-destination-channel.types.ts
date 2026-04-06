import type { ChannelConfig } from "@/features/channels/channel-config.schema";

/** Channel fields used by publishing destination UI (client-safe). */
export type PublishingDestinationChannel = {
	id: string;
	name: string;
	niche: string;
	/** Destination preferences (tone, approval, etc.). */
	config: ChannelConfig;
	platform: "unlinked" | "youtube" | "tiktok" | "instagram";
	externalChannelId: string | null;
	externalChannelTitle: string | null;
	externalChannelHandle: string | null;
	/** Channel image from the platform API when available. */
	externalChannelThumbnailUrl: string | null;
	youtubeConnected: boolean;
	/** Set on first OAuth; reconnect must return this YouTube channel id. */
	boundYoutubeChannelId: string | null;
};
