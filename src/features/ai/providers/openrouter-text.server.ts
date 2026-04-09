import "@tanstack/react-start/server-only";

import { env } from "@/env";

import { buildOpenRouterModelChain } from "../config/model-routing";
import { getProviderApiKeys } from "../lib/provider-api-keys.server";
import {
	executeWithProviderKeyRotation,
	throwProviderHttpError,
} from "../lib/provider-key-execution.server";

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

/**
 * OpenRouter chat completions for script (text) generation.
 *
 * Uses OpenRouter's native `models[]` array so OpenRouter handles provider
 * fallback server-side — no custom retry chain needed on our end.
 *
 * Chain: OPENROUTER_SCRIPT_MODEL → OPENROUTER_SCRIPT_FALLBACK_MODELS
 * (all configured via env; per-key `modelId` in DB overrides the primary model)
 *
 * @see https://openrouter.ai/docs/features/model-routing
 */
export async function generateTextOpenRouter(input: {
	system: string;
	user: string;
}): Promise<string> {
	return executeWithProviderKeyRotation(
		"openrouter",
		async (credential) => {
			// Per-key modelId overrides the primary model for this key.
			const models = buildOpenRouterModelChain(credential.modelId);

			const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${credential.secret}`,
					"HTTP-Referer": env.SERVER_URL ?? "https://klipse.ai",
					"X-Title": "Klipse",
				},
				body: JSON.stringify({
					// OpenRouter tries each model in order if prior ones fail.
					models,
					provider: { allow_fallbacks: true },
					temperature: 0.7,
					max_tokens: 8192,
					messages: [
						{ role: "system", content: input.system },
						{ role: "user", content: input.user },
					],
				}),
				signal: AbortSignal.timeout(120_000),
			});

			if (!res.ok) {
				const t = await res.text().catch(() => "");
				throwProviderHttpError(
					"openrouter",
					res.status,
					t,
					res.headers.get("retry-after"),
				);
			}

			const json = (await res.json()) as {
				model?: string;
				choices?: { message?: { content?: string } }[];
				error?: { message?: string };
			};

			if (json.error?.message) {
				throw new Error(`openrouter_api_error: ${json.error.message}`);
			}

			const content = json.choices?.[0]?.message?.content?.trim();
			if (!content) throw new Error("openrouter_empty_response");
			return content;
		},
		{ providerLabel: "openrouter", taskType: "script" },
	);
}

export async function isOpenRouterConfigured(): Promise<boolean> {
	return (await getProviderApiKeys("openrouter", "script")).length > 0;
}
