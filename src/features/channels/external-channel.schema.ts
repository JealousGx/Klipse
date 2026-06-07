import { z } from "zod"

/** YouTube channel id (24 chars, starts with `UC`). */
export const youtubeChannelIdSchema = z
	.string()
	.trim()
	.regex(
		/^UC[A-Za-z0-9_-]{22}$/,
		"Invalid YouTube channel id (use the id from YouTube Studio → Channel → Advanced → Channel id).",
	)

export const publishingPlatformSchema = z.enum([
	"unlinked",
	"youtube",
	"tiktok",
	"instagram",
])

export type PublishingPlatform = z.infer<typeof publishingPlatformSchema>
