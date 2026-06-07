/**
 * Platform-agnostic display helpers for publishing destinations.
 * Add new platforms here as they launch — every consumer updates automatically.
 */

export type PublishingPlatform = "unlinked" | "youtube" | "tiktok" | "instagram"

/** Human-readable platform name for UI labels. */
export function platformDisplayName(platform: PublishingPlatform): string {
	switch (platform) {
		case "youtube":
			return "YouTube"
		case "tiktok":
			return "TikTok"
		case "instagram":
			return "Instagram"
		default:
			return "Not linked"
	}
}

/**
 * Short OAuth provider label (e.g. "Google" for YouTube).
 * Used in connection UI where the auth provider differs from the platform name.
 */
export function platformAuthProviderName(platform: PublishingPlatform): string {
	switch (platform) {
		case "youtube":
			return "Google"
		case "tiktok":
			return "TikTok"
		case "instagram":
			return "Meta"
		default:
			return "account"
	}
}

/**
 * OAuth start URL for a given platform and destination channel id.
 * Returns null for platforms that don't have an OAuth flow yet.
 */
export function platformOAuthStartUrl(
	platform: PublishingPlatform,
	channelId: string,
): string | null {
	const id = encodeURIComponent(channelId)
	switch (platform) {
		case "youtube":
			return `/api/youtube/oauth/start?channelId=${id}`
		case "tiktok":
			return `/api/tiktok/oauth/start?channelId=${id}`
		case "instagram":
			// Not yet implemented — return null so callers can show an upgrade/coming-soon state.
			return null
		default:
			return null
	}
}

/**
 * Public URL for a channel/profile page on the given platform.
 * Returns null if the platform doesn't support a channel page URL yet.
 */
export function platformChannelUrl(
	platform: PublishingPlatform,
	externalChannelId: string,
	externalChannelHandle?: string | null,
): string | null {
	switch (platform) {
		case "youtube":
			return `https://www.youtube.com/channel/${encodeURIComponent(externalChannelId)}`
		case "tiktok":
			// TikTok profile URLs use the creator_username (handle), not the open_id.
			// Return null when handle is absent — the open_id produces a 404 on TikTok.
			if (!externalChannelHandle) return null
			return `https://www.tiktok.com/@${encodeURIComponent(externalChannelHandle)}`
		case "instagram":
			return `https://www.instagram.com/${encodeURIComponent(externalChannelId)}`
		default:
			return null
	}
}

/**
 * Public watch URL for a published video on the given platform.
 * Returns null if the platform doesn't support a direct video URL yet.
 */
export function platformVideoUrl(
	platform: PublishingPlatform,
	videoId: string,
): string | null {
	switch (platform) {
		case "youtube":
			return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`
		case "tiktok":
			return `https://www.tiktok.com/video/${encodeURIComponent(videoId)}`
		case "instagram":
			return `https://www.instagram.com/p/${encodeURIComponent(videoId)}`
		default:
			return null
	}
}
