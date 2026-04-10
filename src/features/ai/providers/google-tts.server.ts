import "@tanstack/react-start/server-only";

import { env } from "@/env";
import { getProviderApiKeys } from "../lib/provider-api-keys.server";
import {
	executeWithProviderKeyRotation,
	throwProviderHttpError,
} from "../lib/provider-key-execution.server";

/**
 * Google Cloud Text-to-Speech REST (`text:synthesize`).
 * Per-key `modelId` is treated as a voice name override (e.g. `en-US-Neural2-F`),
 * falling back to `GOOGLE_TTS_VOICE_NAME` env var, then the hard-coded default.
 * @see https://cloud.google.com/text-to-speech/docs/reference/rest/v1/text/synthesize
 */
export async function synthesizeGoogleTts(input: {
	text: string;
	voiceName?: string;
	languageCode?: string;
}): Promise<{ audioContentBase64: string }> {
	const globalVoiceName =
		env.GOOGLE_TTS_VOICE_NAME?.trim() || "en-US-Wavenet-G";
	const languageCode = input.languageCode ?? "en-US";

	return executeWithProviderKeyRotation(
		"google_tts",
		async (credential) => {
			// Per-key modelId = voice name override (e.g. admin pins a key to a specific voice).
			const voiceName =
				input.voiceName?.trim() ||
				credential.modelId?.trim() ||
				globalVoiceName;

			const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(credential.secret)}`;

			const res = await fetch(url, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					input: { text: input.text },
					voice: { languageCode, name: voiceName },
					audioConfig: { audioEncoding: "MP3" },
				}),
				signal: AbortSignal.timeout(120_000),
			});

			if (!res.ok) {
				const t = await res.text().catch(() => "");
				throwProviderHttpError(
					"google_tts",
					res.status,
					t,
					res.headers.get("retry-after"),
				);
			}

			const json = (await res.json()) as { audioContent?: string };
			if (!json.audioContent) {
				throw new Error("google_tts_empty");
			}
			return { audioContentBase64: json.audioContent };
		},
		{ providerLabel: "google_tts", taskType: "tts" },
	);
}

export async function isGoogleTtsConfigured(): Promise<boolean> {
	return (await getProviderApiKeys("google_tts", "tts")).length > 0;
}
