import "@tanstack/react-start/server-only";

import { DEFAULT_MODEL_IDS } from "../config/model-routing";
import { ApiKeyPool } from "../lib/api-key-pool.server";
import { getProviderApiKeys } from "../lib/provider-api-keys.server";
import {
	executeWithProviderKeyRotation,
	throwProviderHttpError,
} from "../lib/provider-key-execution.server";

import { env } from "@/env";

/**
 * Official: https://image.pollinations.ai/prompt/{prompt}
 * Override with POLLINATIONS_GEN_BASE for custom/self-hosted deployments.
 */
function imageBaseUrl(): string {
	const base = env.POLLINATIONS_GEN_BASE?.replace(/\/$/, "");
	return base ? `${base}/image` : "https://image.pollinations.ai/prompt";
}

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
	return `${imageBaseUrl()}/${path}?${params.toString()}`;
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
	const keys = await getProviderApiKeys("pollinations", "image");
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
		async (credential) => {
			// Per-key modelId overrides the image model (e.g. "flux-pro").
			const modelOverride = credential.modelId?.trim();
			const url = buildPollinationsImageUrl(
				{ ...input, model: modelOverride ?? input.model },
				credential.secret || undefined,
			);
			const headers: Record<string, string> = {};
			if (credential.secret) {
				headers.Authorization = `Bearer ${credential.secret}`;
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
		{ providerLabel: "pollinations_image", taskType: "image" },
	);
}
