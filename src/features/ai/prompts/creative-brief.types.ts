/**
 * Shared context for Klipse's video prompt generation.
 * Align with `ScriptGenerationContext` / channel row + `channel.config`.
 */
export type ChannelCreativeBrief = {
	channelName: string
	niche: string
	/** Channel tone from config (`dark` | `educational` | `fun`) */
	tone: string
	targetSeconds?: number
	postingFrequency?: string
	captionStyle?: "bold" | "minimal"
	fontPairLabel?: string
	/** Neutral format hint for prompts (short-form vs long-form, viewing context), not a platform brand name. */
	publishingSurfaceLabel?: string
	destinationDisplayName?: string | null
	/** Brand accent for visual prompts (hex). */
	primaryColorHex?: string
	/**
	 * Explicit output aspect ratio from channel config.
	 * Drives image dimensions and composition hints — not inferred from duration.
	 */
	aspectRatio?: "16:9" | "9:16" | "1:1"
}
