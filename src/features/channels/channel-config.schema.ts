import { z } from "zod";

/** Stored JSON for `channels.config` — MVP subset of FEATURE_DOC §2.2. */
export const channelConfigSchema = z
	.object({
		tone: z.enum(["dark", "educational", "fun"]).default("educational"),
		target_duration: z.number().int().min(15).max(600).default(30),
		posting_frequency: z.enum(["daily", "weekly"]).default("weekly"),
		auto_post: z.boolean().default(false),
		require_approval: z.boolean().default(true),
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
