import type {
	ProcessorJobSpec,
	ProcessorProviderKey,
} from "@klipse/video-assembly-shared";

import { reportKeyFailure } from "../utils/callbacks";
import { withTiming } from "../utils/logger";

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

async function callOpenRouterText(
	key: ProcessorProviderKey,
	models: string[],
	system: string,
	user: string,
): Promise<string> {
	const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${key.secret}`,
			"X-Title": "Klipse",
		},
		body: JSON.stringify({
			models,
			provider: { allow_fallbacks: true },
			temperature: 0.7,
			max_tokens: 8192,
			messages: [
				{ role: "system", content: system },
				{ role: "user", content: user },
			],
		}),
		signal: AbortSignal.timeout(120_000),
	});

	if (!res.ok) {
		const t = await res.text().catch(() => "");
		const err = new Error(`openrouter_${res.status}:${t.slice(0, 500)}`);
		(
			err as Error & {
				httpStatus: number;
				bodySnippet: string;
				retryAfterHeader: string | null;
			}
		).httpStatus = res.status;
		(err as Error & { bodySnippet: string }).bodySnippet = t.slice(0, 800);
		(err as Error & { retryAfterHeader: string | null }).retryAfterHeader =
			res.headers.get("retry-after");
		throw err;
	}

	const json = (await res.json()) as {
		choices?: { message?: { content?: string } }[];
		error?: { message?: string };
	};
	if (json.error?.message)
		throw new Error(`openrouter_api_error: ${json.error.message}`);
	const content = json.choices?.[0]?.message?.content?.trim();
	if (!content) throw new Error("openrouter_empty_response");
	return content;
}

function isHttpErr(e: unknown): e is Error & {
	httpStatus: number;
	bodySnippet: string;
	retryAfterHeader: string | null;
} {
	return e instanceof Error && "httpStatus" in e;
}

function shouldRotate(status: number): boolean {
	return (
		status === 429 ||
		status === 401 ||
		status === 403 ||
		status === 408 ||
		status === 503 ||
		(status >= 500 && status < 600)
	);
}

/** Generates script text using OpenRouter, rotating through keys on failure. */
export async function generateScript(spec: ProcessorJobSpec): Promise<string> {
	const {
		openrouterScriptModels: models,
		scriptSystemPrompt: system,
		scriptUserPrompt: user,
	} = spec;
	const keys = spec.providerKeys.openrouter;
	if (keys.length === 0) throw new Error("openrouter_no_keys");

	let lastError: unknown;
	for (const key of keys) {
		try {
			return await withTiming("script-gen", "openrouter.call", () =>
				callOpenRouterText(key, models, system, user),
			);
		} catch (e) {
			lastError = e;
			if (isHttpErr(e) && shouldRotate(e.httpStatus)) {
				await reportKeyFailure(
					spec,
					"openrouter",
					key.id,
					e.httpStatus,
					e.bodySnippet,
					e.retryAfterHeader,
				);
				continue;
			}
			throw e;
		}
	}
	throw lastError ?? new Error("openrouter_all_keys_failed");
}
