import "@tanstack/react-start/server-only";

import type { ChannelCreativeBrief } from "../prompts/creative-brief.types";
import { buildVoiceoverTtsPayload } from "../prompts/voiceover-prompt.server";
import {
	isGoogleTtsConfigured,
	synthesizeGoogleTts,
} from "./google-tts.server";
import { fetchPollinationsSpeech } from "./pollinations-tts.server";

export type AudioGenerationSource = "pollinations" | "google";

export type SynthesizeSpeechInput =
	| { kind: "raw"; text: string; voice?: string }
	| {
			kind: "brief";
			brief: ChannelCreativeBrief;
			scriptMarkdown: string;
			voiceOverride?: string;
	  };

function resolveTtsPayload(input: SynthesizeSpeechInput): {
	text: string;
	voice?: string;
} {
	if (input.kind === "raw") {
		return { text: input.text, voice: input.voice };
	}
	const { plainText, pollinationsVoice } = buildVoiceoverTtsPayload(
		input.brief,
		input.scriptMarkdown,
		input.voiceOverride,
	);
	return { text: plainText, voice: pollinationsVoice };
}

/**
 * TTS: Pollinations Audio → Google TTS.
 * Use `kind: "brief"` to sanitize markdown and map channel tone → Pollinations voice.
 * Future premium order: branch on `resolveAiRoutingTier` in `ai-routing-policy.server.ts`.
 */
export async function synthesizeSpeechWithFallback(
	input: SynthesizeSpeechInput,
): Promise<
	| { source: "pollinations"; buffer: ArrayBuffer }
	| { source: "google"; audioContentBase64: string }
> {
	const { text, voice } = resolveTtsPayload(input);
	try {
		const buffer = await fetchPollinationsSpeech({ text, voice });
		return { source: "pollinations", buffer };
	} catch {
		if (!(await isGoogleTtsConfigured())) {
			throw new Error("tts_all_providers_failed");
		}
		const { audioContentBase64 } = await synthesizeGoogleTts({ text });
		return { source: "google", audioContentBase64 };
	}
}
