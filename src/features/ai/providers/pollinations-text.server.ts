import "@tanstack/react-start/server-only";

import { env } from "@/env";

import { DEFAULT_MODEL_IDS } from "../config/model-routing";
import {
	executeWithProviderKeyRotation,
	throwProviderHttpError,
} from "../lib/provider-key-execution.server";
import { genBase } from "./pollinations-gen-base.server";

function chatCompletionsUrl(): string {
	return `${genBase()}/v1/chat/completions`;
}

/**
 * Pollinations OpenAI-compatible chat Completions.
 */
export async function generateTextPollinationsOpenAi(input: {
	system: string;
	user: string;
}): Promise<string> {
	const model =
		env.POLLINATIONS_TEXT_MODEL?.trim() || DEFAULT_MODEL_IDS.pollinationsText;

	return executeWithProviderKeyRotation(
		"pollinations",
		async (token) => {
			const headers: Record<string, string> = {
				"Content-Type": "application/json",
			};
			if (token) {
				headers.Authorization = `Bearer ${token}`;
			}

			const res = await fetch(chatCompletionsUrl(), {
				method: "POST",
				headers,
				body: JSON.stringify({
					model,
					temperature: 0.7,
					max_tokens: 4096,
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
					"pollinations_text",
					res.status,
					t,
					res.headers.get("retry-after"),
				);
			}

			const json = (await res.json()) as {
				choices?: { message?: { content?: string } }[];
			};
			const content = json.choices?.[0]?.message?.content?.trim();
			if (!content) {
				throw new Error("pollinations_text_empty");
			}
			return content;
		},
		{ providerLabel: "pollinations_text" },
	);
}
