import "@tanstack/react-start/server-only";

import { DEFAULT_MODEL_IDS } from "../config/model-routing";
import { ApiKeyPool } from "../lib/api-key-pool.server";
import { getProviderApiKeys } from "../lib/provider-api-keys.server";
import {
	executeWithProviderKeyRotation,
	throwProviderHttpError,
} from "../lib/provider-key-execution.server";

import { genBase } from "./pollinations-gen-base.server";

function buildPollinationsVideoUrl(
	input: {
		prompt: string;
		durationSec?: number;
		aspectRatio?: "16:9" | "9:16";
		model?: string;
	},
	token: string | undefined,
): string {
	const model = input.model ?? DEFAULT_MODEL_IDS.pollinationsVideo;
	const params = new URLSearchParams({
		model,
		duration: String(input.durationSec ?? 5),
		aspectRatio: input.aspectRatio ?? "9:16",
	});
	if (token) {
		params.set("key", token);
	}
	const path = encodeURIComponent(input.prompt);
	return `${genBase()}/image/${path}?${params.toString()}`;
}

/**
 * Pollinations video — same `/image/{prompt}` route; model selects video (e.g. `wan-fast`).
 * @see https://enter.pollinations.ai/api/docs/llm.txt — GET /image/{prompt} (video models)
 */
export async function pollinationsVideoUrl(input: {
	prompt: string;
	durationSec?: number;
	aspectRatio?: "16:9" | "9:16";
	model?: string;
}): Promise<string> {
	const keys = await getProviderApiKeys("pollinations");
	const pool = new ApiKeyPool(keys);
	const token = pool.next();
	return buildPollinationsVideoUrl(input, token);
}

export async function fetchPollinationsVideo(input: {
	prompt: string;
	durationSec?: number;
	aspectRatio?: "16:9" | "9:16";
	model?: string;
}): Promise<ArrayBuffer> {
	return executeWithProviderKeyRotation(
		"pollinations",
		async (token) => {
			const url = buildPollinationsVideoUrl(input, token);
			const headers: Record<string, string> = {};
			if (token) {
				headers.Authorization = `Bearer ${token}`;
			}
			const res = await fetch(url, {
				headers,
				signal: AbortSignal.timeout(600_000),
			});
			if (!res.ok) {
				const t = await res.text().catch(() => "");
				throwProviderHttpError(
					"pollinations_video",
					res.status,
					t,
					res.headers.get("retry-after"),
				);
			}
			return res.arrayBuffer();
		},
		{ providerLabel: "pollinations_video" },
	);
}
