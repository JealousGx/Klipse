import "@tanstack/react-start/server-only";

import type { ChannelCreativeBrief } from "./creative-brief.types";

export type SoundBedPromptParams = {
	brief: ChannelCreativeBrief;
	/** e.g. "tension", "uplift", "focus", "calm" */
	mood?: string;
	/** Seconds — Pollinations music models may use duration param when wired. */
	targetDurationSec?: number;
};

/**
 * Prompt for **background music / instrumental bed** (under voiceover),
 * e.g. Pollinations `elevenmusic` or similar when you add a music stage.
 * Instrumental, loop-friendly, niche-appropriate; avoids vocal clutter that fights VO.
 */
export function buildSoundBedPrompt(input: SoundBedPromptParams): string {
	const { brief, mood = "supportive", targetDurationSec = 30 } = input;

	const moodLine =
		brief.tone === "dark"
			? "subtle tension, low-mid drive, not horror unless niche requires"
			: brief.tone === "fun"
				? "light, bouncy rhythm, upbeat but not gimmicky"
				: "neutral, positive, modern production bed";

	const lines = [
		`Instrumental background music only, no lead vocals, no spoken words.`,
		`Length ~${targetDurationSec} seconds feel, loop-friendly structure, smooth intro and outro for editing under voiceover.`,
		`Mood: ${mood}. ${moodLine}`,
		`Genre and instrumentation must match the niche: "${brief.niche}" — sound like content that performs well as ${brief.publishingSurfaceLabel ?? "video for this audience"}.`,
		`Channel: ${brief.channelName}. Destination: ${brief.destinationDisplayName ?? "connected publishing"}.`,
		`Dynamics: leave headroom for voiceover; avoid busy melodies in the speech frequency range.`,
	];

	return lines.join(" ");
}
