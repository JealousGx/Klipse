/**
 * Shared context for Klipse media prompts (script, image, voiceover, sound).
 * Align with `ScriptGenerationContext` / channel row + `channel.config`.
 */
export type ChannelCreativeBrief = {
	channelName: string;
	niche: string;
	/** Channel tone from config (`dark` | `educational` | `fun`) */
	tone: string;
	targetSeconds?: number;
	postingFrequency?: "daily" | "weekly";
	captionStyle?: "bold" | "minimal";
	fontPairLabel?: string;
	/** Neutral format hint for prompts (short-form vs long-form, viewing context), not a platform brand name. */
	publishingSurfaceLabel?: string;
	destinationDisplayName?: string | null;
	/** Brand accent for visual prompts (hex). */
	primaryColorHex?: string;
};
