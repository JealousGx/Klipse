import "@tanstack/react-start/server-only";

import { DEFAULT_MODEL_IDS } from "../config/model-routing";
import { ApiKeyPool } from "../lib/api-key-pool.server";
import { getProviderApiKeys } from "../lib/provider-api-keys.server";
import {
	executeWithProviderKeyRotation,
	throwProviderHttpError,
} from "../lib/provider-key-execution.server";

import { genBase } from "./pollinations-gen-base.server";

function buildPollinationsAudioUrl(
	input: { text: string; voice?: string },
	token: string | undefined,
): string {
	const voice = input.voice ?? DEFAULT_MODEL_IDS.pollinationsTtsVoice;
	const params = new URLSearchParams({ voice });
	if (token) {
		params.set("key", token);
	}
	const path = encodeURIComponent(input.text);
	return `${genBase()}/audio/${path}?${params.toString()}`;
}

/**
 * Pollinations TTS — GET returns audio/mpeg.
 * @see https://enter.pollinations.ai/api/docs/llm.txt — GET /audio/{text}
 */
export async function pollinationsAudioUrl(input: {
	text: string;
	voice?: string;
}): Promise<string> {
	const keys = await getProviderApiKeys("pollinations");
	const pool = new ApiKeyPool(keys);
	const token = pool.next();
	return buildPollinationsAudioUrl(input, token);
}

export async function fetchPollinationsSpeech(input: {
	text: string;
	voice?: string;
}): Promise<ArrayBuffer> {
	return executeWithProviderKeyRotation(
		"pollinations",
		async (token) => {
			const url = buildPollinationsAudioUrl(input, token);
			const headers: Record<string, string> = {};
			if (token) {
				headers.Authorization = `Bearer ${token}`;
			}
			const res = await fetch(url, {
				headers,
				signal: AbortSignal.timeout(120_000),
			});
			if (!res.ok) {
				const t = await res.text().catch(() => "");
				throwProviderHttpError(
					"pollinations_audio",
					res.status,
					t,
					res.headers.get("retry-after"),
				);
			}
			return res.arrayBuffer();
		},
		{ providerLabel: "pollinations_audio" },
	);
}
