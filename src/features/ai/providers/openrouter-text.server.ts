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
 * OpenRouter chat completions (OpenAI-compatible).
 * Supports free frontier models: nvidia/nemotron-3-super:free,
 * arceeai/arcee-trinity-large-preview:free, openai/gpt-oss-120b:free, etc.
 *
 * Per-key `modelId` in the DB overrides the global OPENROUTER_SCRIPT_MODEL env var,
 * so different keys can target different models from the same pool.
 *
 * @see https://openrouter.ai/docs
 */
export async function generateTextOpenRouter(input: {
	system: string;
	user: string;
}): Promise<string> {
	const globalModel =
		env.OPENROUTER_SCRIPT_MODEL?.trim() || DEFAULT_MODEL_IDS.openRouterScript;

	return executeWithProviderKeyRotation(
		"openrouter",
		async (credential) => {
			// Per-key modelId takes precedence over the global env/default.
			const model = credential.modelId?.trim() || globalModel;

			const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${credential.secret}`,
					// Required by OpenRouter to identify your app in their dashboard.
					"HTTP-Referer": env.SERVER_URL ?? "https://klipse.ai",
					"X-Title": "Klipse",
				},
				body: JSON.stringify({
					model,
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
				choices?: { message?: { content?: string } }[];
				error?: { message?: string };
			};

			// OpenRouter sometimes returns 200 with an error body.
			if (json.error?.message) {
				throw new Error(`openrouter_api_error: ${json.error.message}`);
			}

			const content = json.choices?.[0]?.message?.content?.trim();
			if (!content) {
				throw new Error("openrouter_empty_response");
			}
			return content;
		},
		{ providerLabel: "openrouter", taskType: "script" },
	);
}

export async function isOpenRouterConfigured(): Promise<boolean> {
	return (await getProviderApiKeys("openrouter", "script")).length > 0;
}
