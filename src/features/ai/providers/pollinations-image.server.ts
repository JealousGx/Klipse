import "@tanstack/react-start/server-only";

import { DEFAULT_MODEL_IDS } from "../config/model-routing";
import { ApiKeyPool } from "../lib/api-key-pool.server";
import { getProviderApiKeys } from "../lib/provider-api-keys.server";
import {
	executeWithProviderKeyRotation,
	throwProviderHttpError,
} from "../lib/provider-key-execution.server";

import { genBase } from "./pollinations-gen-base.server";

function buildPollinationsImageUrl(
	input: {
		prompt: string;
		width?: number;
		height?: number;
		model?: string;
		seed?: number;
	},
	token: string | undefined,
): string {
	const model = input.model ?? DEFAULT_MODEL_IDS.pollinationsImage;
	const params = new URLSearchParams({
		model,
		width: String(input.width ?? 1024),
		height: String(input.height ?? 1024),
	});
	if (input.seed !== undefined) {
		params.set("seed", String(input.seed));
	}
	if (token) {
		params.set("key", token);
	}
	const path = encodeURIComponent(input.prompt);
	return `${genBase()}/image/${path}?${params.toString()}`;
}

/**
 * Pollinations image — GET returns raw image bytes.
 * @see https://enter.pollinations.ai/api/docs/llm.txt — GET /image/{prompt}
 */
export async function pollinationsImageUrl(input: {
	prompt: string;
	width?: number;
	height?: number;
	model?: string;
	seed?: number;
}): Promise<string> {
	const keys = await getProviderApiKeys("pollinations");
	const pool = new ApiKeyPool(keys);
	const token = pool.next();
	return buildPollinationsImageUrl(input, token);
}

export async function fetchPollinationsImage(input: {
	prompt: string;
	width?: number;
	height?: number;
	model?: string;
}): Promise<ArrayBuffer> {
	return executeWithProviderKeyRotation(
		"pollinations",
		async (token) => {
			const url = buildPollinationsImageUrl(input, token);
			const headers: Record<string, string> = {};
			if (token) {
				headers.Authorization = `Bearer ${token}`;
			}
			const res = await fetch(url, {
				headers,
				signal: AbortSignal.timeout(300_000),
			});
			if (!res.ok) {
				const t = await res.text().catch(() => "");
				throwProviderHttpError(
					"pollinations_image",
					res.status,
					t,
					res.headers.get("retry-after"),
				);
			}
			return res.arrayBuffer();
		},
		{ providerLabel: "pollinations_image" },
	);
}
