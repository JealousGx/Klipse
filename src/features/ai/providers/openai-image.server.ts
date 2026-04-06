import "@tanstack/react-start/server-only";

import { env } from "@/env";

import { DEFAULT_MODEL_IDS } from "../config/model-routing";
import {
	executeWithProviderKeyRotation,
	throwProviderHttpError,
} from "../lib/provider-key-execution.server";

/**
 * OpenAI Images (`images/generations`) — DALL·E 3 fallback for image stage.
 * @see https://platform.openai.com/docs/api-reference/images/create
 */
export async function generateImageOpenAiDalle3(input: {
	prompt: string;
	size?: "1024x1024" | "1792x1024" | "1024x1792";
}): Promise<{ url: string }> {
	const base =
		env.OPENAI_API_BASE?.replace(/\/$/, "") ?? "https://api.openai.com/v1";

	return executeWithProviderKeyRotation(
		"openai",
		async (apiKey) => {
			const res = await fetch(`${base}/images/generations`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${apiKey}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					model: DEFAULT_MODEL_IDS.openaiImage,
					prompt: input.prompt,
					n: 1,
					size: input.size ?? "1024x1024",
				}),
				signal: AbortSignal.timeout(300_000),
			});

			if (!res.ok) {
				const t = await res.text().catch(() => "");
				throwProviderHttpError(
					"openai_image",
					res.status,
					t,
					res.headers.get("retry-after"),
				);
			}

			const json = (await res.json()) as {
				data?: ({ url?: string } | undefined)[];
			};
			const url = json.data?.[0]?.url;
			if (!url) {
				throw new Error("openai_image_empty");
			}
			return { url };
		},
		{ providerLabel: "openai_image" },
	);
}
