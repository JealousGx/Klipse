import "@tanstack/react-start/server-only";

import { env } from "@/env";

import { DEFAULT_MODEL_IDS } from "../config/model-routing";
import {
	executeWithProviderKeyRotation,
	throwProviderHttpError,
} from "../lib/provider-key-execution.server";

/**
 * Kling video — vendor-specific; set `KLING_API_BASE` to your provider’s REST host.
 * Many aggregators expose a similar `POST /api/generate` shape — confirm against your dashboard.
 */
export async function createKlingTextToVideo(input: {
	prompt: string;
	type?: string;
	duration?: number;
	aspectRatio?: "16:9" | "9:16" | "1:1";
}): Promise<unknown> {
	const base = (env.KLING_API_BASE?.trim() || "https://kling3api.com").replace(
		/\/$/,
		"",
	);
	const taskType = env.KLING_VIDEO_TYPE?.trim() ?? DEFAULT_MODEL_IDS.klingVideo;

	return executeWithProviderKeyRotation(
		"kling",
		async (key) => {
			const res = await fetch(`${base}/api/generate`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${key}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					type: input.type ?? taskType,
					prompt: input.prompt,
					duration: input.duration ?? 5,
					aspect_ratio: input.aspectRatio ?? "9:16",
				}),
				signal: AbortSignal.timeout(60_000),
			});

			if (!res.ok) {
				const t = await res.text().catch(() => "");
				throwProviderHttpError(
					"kling",
					res.status,
					t,
					res.headers.get("retry-after"),
				);
			}
			return res.json();
		},
		{ providerLabel: "kling" },
	);
}
