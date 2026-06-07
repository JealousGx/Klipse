import { z } from "zod";

/**
 * Platform-specific terms a user must confirm before publishing.
 * Add new literals here as new integrations land — no DB migration needed.
 */
export type PlatformConfirmedTerm = "tiktok_music_usage";

/** Required term keys per platform. Publish is blocked until all are confirmed. */
export const PLATFORM_REQUIRED_TERMS: Partial<
	Record<string, PlatformConfirmedTerm[]>
> = {
	tiktok: ["tiktok_music_usage"],
};

const platformConfirmedTermSchema = z.enum(["tiktok_music_usage"]);

/** Stored JSON for `channels.config` — MVP subset of FEATURE_DOC §2.2. */
export const channelConfigSchema = z
	.object({
		tone: z.enum(["dark", "educational", "fun"]).default("educational"),
		target_duration: z.number().int().min(15).max(600).default(30),
		posting_frequency: z
			.enum([
				"daily",
				"every_2_days",
				"every_3_days",
				"every_4_days",
				"every_5_days",
				"every_6_days",
				"weekly",
				"every_2_weeks",
				"every_3_weeks",
				"monthly",
			])
			.default("weekly"),
		/**
		 * `true` = auto-publish when the pipeline is ready; `false` = ask in dashboard
		 * (and email on paid) before publishing.
		 */
		auto_post: z.boolean().default(false),
		/**
		 * When `true` the user must review and (optionally) edit the caption/tags
		 * before the video publishes. TikTok forces this to `true` in the UI;
		 * other platforms let the user toggle it.
		 */
		review_before_publishing: z.boolean().default(false),
		/**
		 * Platform terms the user has explicitly confirmed for this destination.
		 * Checked before each publish attempt. Each platform defines its required keys
		 * in `PLATFORM_REQUIRED_TERMS`.
		 */
		confirmed_terms: z.array(platformConfirmedTermSchema).default([]),
		/**
		 * Default TikTok privacy level for auto-posted videos on this destination.
		 * Must be one of the values returned by the TikTok creator_info API.
		 * When absent the publisher auto-picks the least-restrictive allowed level.
		 */
		tiktok_default_privacy_level: z.string().optional(),
		/**
		 * Default commercial-content disclosure settings for TikTok posts on this destination.
		 * Stored as destination-level defaults; individual jobs may override when per-video
		 * controls are re-enabled (TIKTOK_PER_VIDEO_CONTROLS_ENABLED flag).
		 */
		tiktok_disclosure: z
			.object({
				enabled: z.boolean().default(false),
				brand_organic: z.boolean().default(false),
				branded_content: z.boolean().default(false),
			})
			.optional(),
		/**
		 * Output aspect ratio for generated video and images.
		 * Decoupled from publishing platform — a 9:16 video can be posted to any platform.
		 */
		aspect_ratio: z.enum(["16:9", "9:16", "1:1"]).default("9:16"),
		style_seed: z
			.number()
			.int()
			.default(() => Math.floor(Math.random() * 1_000_000)),
		visual_identity: z
			.object({
				primary_color: z.string().default("#d87943"),
				font_pair: z
					.tuple([z.string(), z.string()])
					.default(["Inter", "Satoshi"]),
				caption_style: z.enum(["bold", "minimal"]).default("bold"),
			})
			.default(() => ({
				primary_color: "#d87943",
				font_pair: ["Inter", "Satoshi"] as [string, string],
				caption_style: "bold" as const,
			})),
	})
	.strict();

export type ChannelConfig = z.infer<typeof channelConfigSchema>;

export function defaultChannelConfig(): ChannelConfig {
	return channelConfigSchema.parse({});
}

export function parseChannelConfig(raw: unknown): ChannelConfig {
	const parsed = channelConfigSchema.safeParse(raw);
	return parsed.success ? parsed.data : defaultChannelConfig();
}
