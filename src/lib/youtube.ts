/** Canonical watch URL for a YouTube channel by its channel id (`UC…`). */
export function youtubeChannelUrl(channelId: string): string {
	return `https://www.youtube.com/channel/${encodeURIComponent(channelId)}`
}

/** Watch URL for an uploaded video by YouTube video id. */
export function youtubeWatchUrl(videoId: string): string {
	return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`
}
