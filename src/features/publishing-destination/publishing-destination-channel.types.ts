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
	/** True when a platform OAuth refresh token is stored. */
	oauthConnected: boolean;
	/** External account id locked on first OAuth; reconnect must match. */
	boundExternalAccountId: string | null;
	/** Whether to generate AI background sound for videos on this channel (Creator+). */
	soundEnabled: boolean;
	/** Optional prompt hint for sound generation; null = auto-generate from brief. */
	soundPromptHint: string | null;
};
