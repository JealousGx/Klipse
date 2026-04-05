/** Canonical watch URL for a YouTube channel by its channel id (`UC…`). */
export function youtubeChannelUrl(channelId: string): string {
	return `https://www.youtube.com/channel/${encodeURIComponent(channelId)}`;
}
