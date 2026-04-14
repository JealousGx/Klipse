import "@tanstack/react-start/server-only";

import { getProviderApiKeys } from "../lib/provider-api-keys.server";
import {
	executeWithProviderKeyRotation,
	throwProviderHttpError,
} from "../lib/provider-key-execution.server";

const REPLICATE_BASE = "https://api.replicate.com/v1";

// FLUX Schnell on Replicate: ~$0.003/image, fast 2-4 step generation.
const FLUX_SCHNELL_MODEL = "black-forest-labs/flux-schnell";

/** Max burst-limit retries before escalating to the key-rotation system. */
const MAX_BURST_RETRIES = 4;

type AspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4" | "2:3" | "3:2";

/**
 * Replicate FLUX Schnell — image fallback (~$0.003/image).
 * Uses synchronous mode (Prefer: wait=60) to avoid polling overhead.
 * Output is a CDN URL; we download it and return raw bytes.
 *
 * Retries up to {@link MAX_BURST_RETRIES} times on 429 burst-limit responses
 * (accounts with burst=1 rate limit hit this when >1 request fires in parallel).
 * Respects Retry-After header; falls back to exponential backoff (1s → 2s → 4s → 8s).
 *
 * @see https://replicate.com/black-forest-labs/flux-schnell
 */
export async function generateImageReplicate(input: {
	prompt: string;
	aspectRatio?: AspectRatio;
}): Promise<ArrayBuffer> {
	return executeWithProviderKeyRotation(
		"replicate",
		async (credential) => {
			let attempt = 0;

			while (true) {
				const res = await fetch(`${REPLICATE_BASE}/predictions`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${credential.secret}`,
						// Synchronous mode: block until done (max 60s).
						Prefer: "wait=60",
					},
					body: JSON.stringify({
						version: credential.modelId ?? FLUX_SCHNELL_MODEL,
						input: {
							prompt: input.prompt,
							aspect_ratio: input.aspectRatio ?? "16:9",
							output_format: "webp",
							output_quality: 85,
							num_outputs: 1,
						},
					}),
					signal: AbortSignal.timeout(90_000),
				});

				// Retry burst-limit 429s with backoff before escalating to key rotation.
				if (res.status === 429 && attempt < MAX_BURST_RETRIES) {
					attempt++;
					const retryAfterSec = Number(res.headers.get("retry-after") ?? "0");
					const waitMs =
						retryAfterSec > 0
							? retryAfterSec * 1000
							: Math.min(1000 * 2 ** (attempt - 1), 16_000); // 1s, 2s, 4s, 8s
					await new Promise<void>((r) => setTimeout(r, waitMs));
					continue;
				}

				if (!res.ok) {
					const t = await res.text().catch(() => "");
					throwProviderHttpError(
						"replicate_image",
						res.status,
						t,
						res.headers.get("retry-after"),
					);
				}

				const prediction = (await res.json()) as {
					status: string;
					output?: string[];
					error?: string;
					urls?: { get?: string };
				};

				console.log(
					`Replicate image generation succeeded on attempt ${attempt + 1}`,
					{ prediction },
				);

				if (prediction.error) {
					throw new Error(`replicate_image_error: ${prediction.error}`);
				}

				// Synchronous mode returns output immediately; fall back to polling if needed.
				let outputUrl = prediction.output?.[0];

				if (
					!outputUrl &&
					prediction.status !== "failed" &&
					prediction.urls?.get
				) {
					outputUrl = await pollReplicatePrediction(
						credential.secret,
						prediction.urls.get,
					);
				}

				if (!outputUrl) throw new Error("replicate_image_no_output");

				// Download the CDN image and return as ArrayBuffer.
				const imgRes = await fetch(outputUrl, {
					signal: AbortSignal.timeout(60_000),
				});
				if (!imgRes.ok)
					throw new Error(`replicate_image_download_failed: ${imgRes.status}`);
				return imgRes.arrayBuffer();
			}
		},
		{ providerLabel: "replicate_image", taskType: "image" },
	);
}

/** Poll `urls.get` until succeeded/failed (max 90s, 3s intervals). */
async function pollReplicatePrediction(
	secret: string,
	getUrl: string,
): Promise<string> {
	const deadline = Date.now() + 90_000;
	while (Date.now() < deadline) {
		await new Promise((r) => setTimeout(r, 3000));
		const res = await fetch(getUrl, {
			headers: { Authorization: `Bearer ${secret}` },
			signal: AbortSignal.timeout(15_000),
		});
		if (!res.ok) throw new Error(`replicate_poll_error: ${res.status}`);
		const data = (await res.json()) as {
			status: string;
			output?: string[];
			error?: string;
		};
		if (data.error) throw new Error(`replicate_image_error: ${data.error}`);
		if (data.status === "succeeded" && data.output?.[0]) return data.output[0];
		if (data.status === "failed") throw new Error("replicate_image_failed");
	}
	throw new Error("replicate_image_timeout");
}

export async function isReplicateConfigured(): Promise<boolean> {
	return (await getProviderApiKeys("replicate", "image")).length > 0;
}
