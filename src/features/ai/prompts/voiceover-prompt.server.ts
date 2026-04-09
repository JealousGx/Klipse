import "@tanstack/react-start/server-only";

import type { ChannelCreativeBrief } from "./creative-brief.types";

export type VoiceoverTtsPayload = {
	/** Plain text safe for any speech API (markdown stripped, duration-capped). */
	plainText: string;
	/** Voice ID for Unreal Speech fallback. Google TTS uses GOOGLE_TTS_VOICE_NAME env. */
	voice: string;
	/** Target duration in seconds (passed through for caller reference). */
	targetSeconds: number;
};

// Average spoken words per minute for TTS engines. Slightly conservative.
const WORDS_PER_MINUTE = 140;

/**
 * Calculate the maximum word count for a given target duration.
 * 30s → ~70 words (~350 chars)
 * 60s → ~140 words (~700 chars)
 */
export function targetDurationToMaxWords(targetSeconds: number): number {
	return Math.ceil((targetSeconds / 60) * WORDS_PER_MINUTE);
}

/**
 * Strip markdown formatting so TTS engines don't read "##" or "**" aloud.
 * Also removes section headers, bullet lists, and stage directions in italics.
 */
export function sanitizeScriptForTts(raw: string): string {
	return (
		raw
			// Remove markdown headers
			.replace(/^#{1,6}\s+.*/gm, "")
			// Remove bold/italic markers (keep text)
			.replace(/\*\*([^*]+)\*\*/g, "$1")
			.replace(/\*([^*]+)\*/g, "$1")
			// Remove bullet points and numbered lists (keep text)
			.replace(/^[-*]\s+/gm, "")
			.replace(/^\d+\.\s+/gm, "")
			// Remove parenthetical stage directions like (0-5s) or (beat)
			.replace(/\([^)]{0,30}\)/g, "")
			// Collapse extra whitespace
			.replace(/\n{3,}/g, "\n\n")
			.replace(/\s+/g, " ")
			.trim()
	);
}

/**
 * Truncate text to a maximum word count, breaking at word boundaries.
 * Adds "..." only if truncation actually occurred.
 */
export function truncateToWordCount(text: string, maxWords: number): string {
	const words = text.split(/\s+/);
	if (words.length <= maxWords) return text;
	return `${words.slice(0, maxWords).join(" ")}…`;
}

/**
 * Map channel tone to Unreal Speech voice IDs.
 * Google TTS voice is controlled separately via GOOGLE_TTS_VOICE_NAME env.
 */
export function selectVoiceForChannelTone(tone: string): string {
	const t = tone.toLowerCase();
	if (t === "dark") return "Will"; // deeper voice
	if (t === "fun") return "Scarlett"; // energetic
	if (t === "educational") return "Dan"; // authoritative
	return "Scarlett"; // default
}

/**
 * Build a TTS-ready payload from a script markdown and channel brief.
 *
 * Optimizations for quota efficiency:
 * - Strips all markdown formatting (saves ~15-20% chars)
 * - Truncates to target duration word count (hard cap)
 * - For 30s scripts: ~70 words ≈ 350 chars (vs old 6000 char limit)
 */
export function buildVoiceoverTtsPayload(
	brief: ChannelCreativeBrief,
	scriptMarkdown: string,
	voiceOverride?: string,
): VoiceoverTtsPayload {
	const targetSeconds = brief.targetSeconds ?? 30;
	const maxWords = targetDurationToMaxWords(targetSeconds);

	const sanitized = sanitizeScriptForTts(scriptMarkdown);
	const plainText = truncateToWordCount(sanitized, maxWords);
	const voice = voiceOverride?.trim() || selectVoiceForChannelTone(brief.tone);

	return { plainText, voice, targetSeconds };
}
