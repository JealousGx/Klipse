import "@tanstack/react-start/server-only";

import { DEFAULT_MODEL_IDS } from "../config/model-routing";
import {
	executeWithProviderKeyRotation,
	throwProviderHttpError,
} from "../lib/provider-key-execution.server";

const LUMA_GENERATIONS = "https://api.lumalabs.ai/dream-machine/v1/generations";

export type LumaGenerationState =
	| "queued"
	| "dreaming"
	| "completed"
	| "failed";

export type LumaGeneration = {
	id: string;
	state: LumaGenerationState;
	failure_reason?: string | null;
	assets?: { video?: string };
};

/**
 * Luma Dream Machine — create generation + poll until complete.
 * @see https://docs.lumalabs.ai/docs/video-generation
 */
export async function createLumaTextToVideo(input: {
	prompt: string;
	model?: string;
	resolution?: "540p" | "720p" | "1080p";
	duration?: "5s" | "9s";
	aspectRatio?: string;
}): Promise<LumaGeneration> {
	return executeWithProviderKeyRotation(
		"luma",
		async (key) => {
			const res = await fetch(LUMA_GENERATIONS, {
				method: "POST",
				headers: {
					accept: "application/json",
					authorization: `Bearer ${key}`,
					"content-type": "application/json",
				},
				body: JSON.stringify({
					prompt: input.prompt,
					model: input.model ?? DEFAULT_MODEL_IDS.lumaVideo,
					resolution: input.resolution ?? "720p",
					duration: input.duration ?? "5s",
					...(input.aspectRatio ? { aspect_ratio: input.aspectRatio } : {}),
				}),
				signal: AbortSignal.timeout(60_000),
			});

			if (!res.ok) {
				const t = await res.text().catch(() => "");
				throwProviderHttpError(
					"luma_create",
					res.status,
					t,
					res.headers.get("retry-after"),
				);
			}
			return (await res.json()) as LumaGeneration;
		},
		{ providerLabel: "luma_create" },
	);
}

export async function getLumaGeneration(id: string): Promise<LumaGeneration> {
	return executeWithProviderKeyRotation(
		"luma",
		async (key) => {
			const res = await fetch(`${LUMA_GENERATIONS}/${encodeURIComponent(id)}`, {
				headers: {
					accept: "application/json",
					authorization: `Bearer ${key}`,
				},
				signal: AbortSignal.timeout(60_000),
			});
			if (!res.ok) {
				const t = await res.text().catch(() => "");
				throwProviderHttpError(
					"luma_get",
					res.status,
					t,
					res.headers.get("retry-after"),
				);
			}
			return (await res.json()) as LumaGeneration;
		},
		{ providerLabel: "luma_get" },
	);
}

/**
 * Poll until terminal state (simple backoff; production may use webhooks).
 */
export async function waitForLumaCompletion(
	id: string,
	opts?: { maxAttempts?: number; delayMs?: number },
): Promise<LumaGeneration> {
	const max = opts?.maxAttempts ?? 120;
	const delay = opts?.delayMs ?? 2000;
	for (let i = 0; i < max; i++) {
		const g = await getLumaGeneration(id);
		if (g.state === "completed" || g.state === "failed") {
			return g;
		}
		await new Promise((r) => setTimeout(r, delay));
	}
	throw new Error("luma_poll_timeout");
}
