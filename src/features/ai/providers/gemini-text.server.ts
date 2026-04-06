import "@tanstack/react-start/server-only";

import { env } from "@/env";

import { DEFAULT_MODEL_IDS } from "../config/model-routing";
import { getProviderApiKeys } from "../lib/provider-api-keys.server";
import {
	executeWithProviderKeyRotation,
	throwProviderHttpError,
} from "../lib/provider-key-execution.server";

/**
 * Gemini `generateContent` (Google AI Studio / API key).
 * @see https://ai.google.dev/gemini-api/docs/quickstart
 */
export async function generateTextGemini(input: {
	system: string;
	user: string;
}): Promise<string> {
	const modelId =
		env.GEMINI_SCRIPT_MODEL?.trim() || DEFAULT_MODEL_IDS.geminiScript;

	return executeWithProviderKeyRotation(
		"gemini",
		async (apiKey) => {
			const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${encodeURIComponent(apiKey)}`;

			const res = await fetch(url, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					systemInstruction: {
						parts: [{ text: input.system }],
					},
					contents: [{ parts: [{ text: input.user }] }],
					generationConfig: {
						temperature: 0.7,
						maxOutputTokens: 8192,
					},
				}),
				signal: AbortSignal.timeout(120_000),
			});

			if (!res.ok) {
				const t = await res.text().catch(() => "");
				throwProviderHttpError(
					"gemini",
					res.status,
					t,
					res.headers.get("retry-after"),
				);
			}

			const json = (await res.json()) as {
				candidates?: { content?: { parts?: { text?: string }[] } }[];
			};
			const text = json.candidates?.[0]?.content?.parts
				?.map((p) => p.text ?? "")
				.join("")
				.trim();

			if (!text) {
				throw new Error("gemini_empty_response");
			}
			return text;
		},
		{ providerLabel: "gemini" },
	);
}

export async function isGeminiConfigured(): Promise<boolean> {
	return (await getProviderApiKeys("gemini")).length > 0;
}
