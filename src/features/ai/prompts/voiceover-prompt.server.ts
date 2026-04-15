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
 * Strip all non-speech content from a script so TTS engines only receive
 * natural spoken text. Removes markdown, bracketed/parenthetical stage
 * directions, code fences, image prompts, URLs, and the entire Visual scenes
 * section (image prompts must never be spoken).
 */
export function sanitizeScriptForTts(raw: string): string {
	return (
		raw
			// Remove Visual scenes section entirely — image prompts, never spoken
			.replace(/^#{1,6}\s+visual\s+scenes\b[\s\S]*/im, "")
			// Remove markdown headers (section titles not spoken)
			.replace(/^#{1,6}\s+.*/gm, "")
			// Remove triple backtick code fences entirely
			.replace(/```[\s\S]*?```/g, "")
			// Unwrap inline backtick spans — keep inner text, strip markers
			.replace(/`([^`\n]+)`/g, "$1")
			// Remove any remaining lone/unclosed backticks (TTS says "backquote")
			.replace(/`/g, "")
			// Remove bracketed annotations: [visuals], [cut], [b-roll], [0-5s], etc.
			.replace(/\[[^\]]{0,80}\]/g, "")
			// Remove bold/italic/underline markers (keep inner text)
			.replace(/[*_]{1,3}([^*_\n]+)[*_]{1,3}/g, "$1")
			// Remove bullet points and numbered lists (keep text)
			.replace(/^[-*+]\s+/gm, "")
			.replace(/^\d+\.\s+/gm, "")
			// Remove blockquote markers
			.replace(/^>\s*/gm, "")
			// Remove horizontal rules
			.replace(/^[-*_]{3,}\s*$/gm, "")
			// Remove parenthetical stage directions: (0-5s), (beat), (visual: pan), etc.
			.replace(/\([^)]{0,80}\)/g, "")
			// Remove URLs
			.replace(/https?:\/\/\S+/g, "")
			// Final safety net: strip any remaining non-speech symbols.
			// Keeps unicode letters (ÉñüCJK…), numbers, whitespace,
			// and natural punctuation TTS engines use for pacing/intonation.
			.replace(/[^\p{L}\p{N}\s.,!?;:'"'"\-–—…]/gu, "")
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
