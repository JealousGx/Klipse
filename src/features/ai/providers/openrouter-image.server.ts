import "@tanstack/react-start/server-only";

import { env } from "@/env";

import { DEFAULT_MODEL_IDS } from "../config/model-routing";
import { getProviderApiKeys } from "../lib/provider-api-keys.server";
import {
	executeWithProviderKeyRotation,
	throwProviderHttpError,
} from "../lib/provider-key-execution.server";

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

/**
 * OpenRouter image generation via chat/completions with modalities: ["image"].
 * Uses FLUX.2 models which are currently free on OpenRouter.
 *
 * Response shape: choices[0].message.images[0].image_url.url (base64 data URL)
 *
 * @see https://openrouter.ai/docs/features/images
 */
export async function generateImageOpenRouter(input: {
	prompt: string;
	aspectRatio?: "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
}): Promise<ArrayBuffer> {
	return executeWithProviderKeyRotation(
		"openrouter",
		async (credential) => {
			// Per-key modelId overrides the global image model.
			const model =
				credential.modelId?.trim() ||
				env.OPENROUTER_IMAGE_MODEL?.trim() ||
				DEFAULT_MODEL_IDS.openRouterImage;

			const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${credential.secret}`,
					"HTTP-Referer": env.SERVER_URL ?? "https://klipse.ai",
					"X-Title": "Klipse",
				},
				body: JSON.stringify({
					model,
					modalities: ["image"],
					image_config: {
						aspect_ratio: input.aspectRatio ?? "16:9",
					},
					messages: [{ role: "user", content: input.prompt }],
				}),
				signal: AbortSignal.timeout(300_000),
			});

			if (!res.ok) {
				const t = await res.text().catch(() => "");
				throwProviderHttpError(
					"openrouter_image",
					res.status,
					t,
					res.headers.get("retry-after"),
				);
			}

			const json = (await res.json()) as {
				choices?: {
					message?: {
						images?: { image_url?: { url?: string } }[];
					};
				}[];
				error?: { message?: string };
			};

			if (json.error?.message) {
				throw new Error(`openrouter_image_error: ${json.error.message}`);
			}

			const dataUrl = json.choices?.[0]?.message?.images?.[0]?.image_url?.url;
			if (!dataUrl) throw new Error("openrouter_image_empty");

			// Strip "data:image/png;base64," prefix and decode to ArrayBuffer.
			const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
			if (!base64) throw new Error("openrouter_image_invalid_data_url");
			const binary = Buffer.from(base64, "base64");
			return binary.buffer.slice(
				binary.byteOffset,
				binary.byteOffset + binary.byteLength,
			) as ArrayBuffer;
		},
		{ providerLabel: "openrouter_image", taskType: "image" },
	);
}

export async function isOpenRouterImageConfigured(): Promise<boolean> {
	return (await getProviderApiKeys("openrouter", "image")).length > 0;
}
