import "@tanstack/react-start/server-only";

import { env } from "@/env";

import { getProviderApiKeys } from "../lib/provider-api-keys.server";
import {
	executeWithProviderKeyRotation,
	throwProviderHttpError,
} from "../lib/provider-key-execution.server";

const ELEVENLABS_BASE = "https://api.elevenlabs.io/v1";

/**
 * ElevenLabs Sound Generation — Creator+ feature.
 * Generates ambient/background sound effects from a text prompt.
 * 10K credits/month free (1 credit ≈ 1 char of TTS; sound gen uses flat credits).
 *
 * Supports key rotation — add multiple ElevenLabs keys in admin panel.
 *
 * @see https://elevenlabs.io/docs/api-reference/sound-generation
 */
export async function generateSoundElevenLabs(input: {
	prompt: string;
	durationSeconds?: number;
	/** 0–1: how closely to follow the prompt vs. random variation. @default 0.3 */
	promptInfluence?: number;
}): Promise<ArrayBuffer> {
	return executeWithProviderKeyRotation(
		"elevenlabs",
		async (credential) => {
			const durationSeconds =
				input.durationSeconds ?? env.ELEVENLABS_SOUND_DURATION_SECONDS;

			const res = await fetch(`${ELEVENLABS_BASE}/sound-generation`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"xi-api-key": credential.secret,
				},
				body: JSON.stringify({
					text: input.prompt,
					duration_seconds: durationSeconds,
					prompt_influence: input.promptInfluence ?? 0.3,
				}),
				signal: AbortSignal.timeout(60_000),
			});

			if (!res.ok) {
				const t = await res.text().catch(() => "");
				throwProviderHttpError(
					"elevenlabs_sound",
					res.status,
					t,
					res.headers.get("retry-after"),
				);
			}

			// Response is raw binary audio (MP3).
			return res.arrayBuffer();
		},
		{ providerLabel: "elevenlabs_sound", taskType: "sound" },
	);
}

export async function isElevenLabsConfigured(): Promise<boolean> {
	return (await getProviderApiKeys("elevenlabs", "sound")).length > 0;
}
