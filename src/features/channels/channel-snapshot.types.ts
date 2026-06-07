/** Subset of channel row for dashboard cards (no server-only import). */
export type ChannelSnapshot = {
	id: string
	name: string
	niche: string
	platform: "unlinked" | "youtube" | "tiktok" | "instagram"
	externalChannelId: string | null
	/** True when a platform OAuth refresh token is stored (any platform). */
	oauthConnected: boolean
}
