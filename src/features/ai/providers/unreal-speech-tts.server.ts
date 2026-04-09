import "@tanstack/react-start/server-only";

import { env } from "@/env";

import { DEFAULT_MODEL_IDS } from "../config/model-routing";
import { getProviderApiKeys } from "../lib/provider-api-keys.server";
import {
	executeWithProviderKeyRotation,
	throwProviderHttpError,
} from "../lib/provider-key-execution.server";

const UNREAL_SPEECH_BASE = "https://api.v8.unrealspeech.com";

// /stream: up to 1000 chars, returns raw binary immediately (~0.3s latency).
// /speech: up to 3000 chars, async S3 URL response.
// For 30s scripts (~350 chars) /stream is always used.
const STREAM_CHAR_LIMIT = 950; // slightly under 1000 to be safe

/**
 * Unreal Speech TTS fallback — 250K chars/month free, no card required.
 * Voices: Scarlett | Dan | Liv | Will | Amy
 *
 * Uses /stream endpoint for short texts (≤950 chars), /speech for longer ones.
 *
 * @see https://docs.unrealspeech.com
 */
export async function synthesizeUnrealSpeech(input: {
	text: string;
	voice?: string;
}): Promise<ArrayBuffer> {
	return executeWithProviderKeyRotation(
		"unreal_speech",
		async (credential) => {
			const voice =
				input.voice?.trim() ||
				credential.modelId?.trim() || // Per-key voice override via modelId field.
				env.UNREAL_SPEECH_VOICE?.trim() ||
				DEFAULT_MODEL_IDS.unrealSpeechVoice;

			if (input.text.length <= STREAM_CHAR_LIMIT) {
				return streamSpeech(credential.secret, input.text, voice);
			}
			return asyncSpeech(credential.secret, input.text, voice);
		},
		{ providerLabel: "unreal_speech", taskType: "tts" },
	);
}

/** /stream — returns binary MP3 directly. Best for ≤950 chars. */
async function streamSpeech(
	apiKey: string,
	text: string,
	voice: string,
): Promise<ArrayBuffer> {
	const res = await fetch(`${UNREAL_SPEECH_BASE}/stream`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify({
			Text: text,
			VoiceId: voice,
			Bitrate: "192k",
			Codec: "libmp3lame",
		}),
		signal: AbortSignal.timeout(30_000),
	});

	if (!res.ok) {
		const t = await res.text().catch(() => "");
		throwProviderHttpError(
			"unreal_speech",
			res.status,
			t,
			res.headers.get("retry-after"),
		);
	}

	return res.arrayBuffer();
}

/** /speech — async, returns S3 URL; we download and return bytes. */
async function asyncSpeech(
	apiKey: string,
	text: string,
	voice: string,
): Promise<ArrayBuffer> {
	const res = await fetch(`${UNREAL_SPEECH_BASE}/speech`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify({ Text: text, VoiceId: voice, Bitrate: "192k" }),
		signal: AbortSignal.timeout(60_000),
	});

	if (!res.ok) {
		const t = await res.text().catch(() => "");
		throwProviderHttpError(
			"unreal_speech",
			res.status,
			t,
			res.headers.get("retry-after"),
		);
	}

	const json = (await res.json()) as {
		OutputUri?: string;
		TaskStatus?: string;
	};
	const outputUri = json.OutputUri;
	if (!outputUri) throw new Error("unreal_speech_no_output_uri");

	const audioRes = await fetch(outputUri, {
		signal: AbortSignal.timeout(60_000),
	});
	if (!audioRes.ok)
		throw new Error(`unreal_speech_download_failed: ${audioRes.status}`);
	return audioRes.arrayBuffer();
}

export async function isUnrealSpeechConfigured(): Promise<boolean> {
	return (await getProviderApiKeys("unreal_speech", "tts")).length > 0;
}
