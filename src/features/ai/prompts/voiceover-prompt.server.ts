import "@tanstack/react-start/server-only";

import type { ChannelCreativeBrief } from "./creative-brief.types";

export type VoiceoverTtsPayload = {
	/** Plain text safe for Google / Pollinations speech APIs (no markdown headings). */
	plainText: string;
	/** Pollinations `voice` query param — maps from channel tone. */
	pollinationsVoice: string;
};

/**
 * Strip markdown / bullets so TTS engines don't read "##" or "**" aloud.
 */
export function sanitizeScriptForTts(raw: string): string {
	let t = raw
		.replace(/^#{1,6}\s+/gm, "")
		.replace(/\*\*([^*]+)\*\*/g, "$1")
		.replace(/\*([^*]+)\*/g, "$1")
		.replace(/^[-*]\s+/gm, "")
		.replace(/^\d+\.\s+/gm, "")
		.replace(/\n{3,}/g, "\n\n")
		.trim();

	t = t.replace(/\s+/g, " ").trim();
	if (t.length > 6000) {
		t = `${t.slice(0, 5997)}...`;
	}
	return t;
}

/**
 * Map channel tone to Pollinations voice ids (see Pollinations docs).
 */
export function selectVoiceForChannelTone(tone: string): string {
	const t = tone.toLowerCase();
	if (t === "dark") {
		return "onyx";
	}
	if (t === "fun") {
		return "nova";
	}
	return "alloy";
}

/**
 * Builds a single voiceover line for TTS. Does **not** prepend meta-instructions
 * to the spoken string (Google would read them). Style is expressed via **voice selection**.
 */
export function buildVoiceoverTtsPayload(
	brief: ChannelCreativeBrief,
	scriptMarkdown: string,
	voiceOverride?: string,
): VoiceoverTtsPayload {
	const plain = sanitizeScriptForTts(scriptMarkdown);
	const pollinationsVoice =
		voiceOverride?.trim() || selectVoiceForChannelTone(brief.tone);
	return { plainText: plain, pollinationsVoice };
}
