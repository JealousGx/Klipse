import "@tanstack/react-start/server-only";

import type { ChannelCreativeBrief } from "../prompts/creative-brief.types";
import { buildVoiceoverTtsPayload } from "../prompts/voiceover-prompt.server";
import {
	isGoogleTtsConfigured,
	synthesizeGoogleTts,
} from "./google-tts.server";
import {
	isUnrealSpeechConfigured,
	synthesizeUnrealSpeech,
} from "./unreal-speech-tts.server";

export type AudioGenerationSource = "google" | "unreal_speech";

export type SynthesizeSpeechInput =
	| { kind: "raw"; text: string; voice?: string; targetSeconds?: number }
	| {
			kind: "brief";
			brief: ChannelCreativeBrief;
			scriptMarkdown: string;
			voiceOverride?: string;
	  };

function resolveTtsText(input: SynthesizeSpeechInput): {
	text: string;
	unrealVoice: string;
	targetSeconds: number;
} {
	if (input.kind === "raw") {
		return {
			text: input.text,
			unrealVoice: input.voice ?? "Scarlett",
			targetSeconds: input.targetSeconds ?? 30,
		};
	}
	const { plainText, voice, targetSeconds } = buildVoiceoverTtsPayload(
		input.brief,
		input.scriptMarkdown,
		input.voiceOverride,
	);
	return { text: plainText, unrealVoice: voice, targetSeconds };
}

/**
 * TTS chain:
 *   1. Google Cloud TTS (1M Neural2 chars/month free) — primary
 *   2. Unreal Speech (250K chars/month free) — fallback
 *
 * Always returns ArrayBuffer (MP3/WAV) regardless of which provider succeeded.
 */
export async function synthesizeSpeechWithFallback(
	input: SynthesizeSpeechInput,
): Promise<{ source: AudioGenerationSource; buffer: ArrayBuffer }> {
	const { text, unrealVoice } = resolveTtsText(input);
	const errors: string[] = [];

	// 1. Google Cloud TTS (primary)
	if (await isGoogleTtsConfigured()) {
		try {
			const { audioContentBase64 } = await synthesizeGoogleTts({ text });
			const buf = Buffer.from(audioContentBase64, "base64");
			return {
				source: "google",
				buffer: buf.buffer.slice(
					buf.byteOffset,
					buf.byteOffset + buf.byteLength,
				) as ArrayBuffer,
			};
		} catch (e) {
			errors.push(`google_tts: ${e instanceof Error ? e.message : String(e)}`);
		}
	}

	// 2. Unreal Speech (fallback)
	if (await isUnrealSpeechConfigured()) {
		try {
			const buffer = await synthesizeUnrealSpeech({ text, voice: unrealVoice });
			return { source: "unreal_speech", buffer };
		} catch (e) {
			errors.push(
				`unreal_speech: ${e instanceof Error ? e.message : String(e)}`,
			);
		}
	}

	throw new Error(
		`tts_all_failed: ${errors.join(" | ") || "no TTS providers configured"}`,
	);
}
