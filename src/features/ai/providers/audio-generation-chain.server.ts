import "@tanstack/react-start/server-only";

import type { ChannelCreativeBrief } from "../prompts/creative-brief.types";
import { buildVoiceoverTtsPayload } from "../prompts/voiceover-prompt.server";
import {
	isGoogleTtsConfigured,
	synthesizeGoogleTts,
} from "./google-tts.server";
import { fetchPollinationsSpeech } from "./pollinations-tts.server";

export type AudioGenerationSource = "google" | "pollinations";

export type SynthesizeSpeechInput =
	| { kind: "raw"; text: string; voice?: string }
	| {
			kind: "brief";
			brief: ChannelCreativeBrief;
			scriptMarkdown: string;
			voiceOverride?: string;
	  };

function resolveTtsText(input: SynthesizeSpeechInput): {
	text: string;
	pollinationsVoice: string;
} {
	if (input.kind === "raw") {
		return { text: input.text, pollinationsVoice: input.voice ?? "alloy" };
	}
	const { plainText, voice } = buildVoiceoverTtsPayload(
		input.brief,
		input.scriptMarkdown,
		input.voiceOverride,
	);
	return { text: plainText, pollinationsVoice: voice };
}

/**
 * TTS: **Google Cloud TTS** (primary, free 4M chars/month) → **Pollinations Audio** (fallback, free).
 * Always returns `ArrayBuffer` regardless of which provider succeeded.
 *
 * Google TTS voice is controlled by `GOOGLE_TTS_VOICE_NAME` env var (default: en-US-Neural2-A).
 * Pollinations voice is tone-mapped from channel brief.
 */
export async function synthesizeSpeechWithFallback(
	input: SynthesizeSpeechInput,
): Promise<{ source: AudioGenerationSource; buffer: ArrayBuffer }> {
	const { text, pollinationsVoice } = resolveTtsText(input);

	if (await isGoogleTtsConfigured()) {
		try {
			const { audioContentBase64 } = await synthesizeGoogleTts({ text });
			const buf = Buffer.from(audioContentBase64, "base64");
			return { source: "google", buffer: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer };
		} catch {
			// fall through to Pollinations
		}
	}

	const buffer = await fetchPollinationsSpeech({ text, voice: pollinationsVoice });
	return { source: "pollinations", buffer };
}
