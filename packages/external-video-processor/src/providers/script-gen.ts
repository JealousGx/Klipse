import type {
	ProcessorJobSpec,
	ProcessorProviderKey,
} from "@klipse/video-assembly-shared"

import { reportKeyFailure } from "../utils/callbacks"
import { withTiming } from "../utils/logger"

const OPENROUTER_BASE = "https://openrouter.ai/api/v1"
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta"
const GEMINI_DEFAULT_MODEL = "gemini-2.5-flash-lite"

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
			response_format: { type: "json_object" },
			messages: [
				{ role: "system", content: system },
				{ role: "user", content: user },
			],
		}),
		signal: AbortSignal.timeout(120_000),
	})

	if (!res.ok) {
		const t = await res.text().catch(() => "")
		const err = new Error(`openrouter_${res.status}:${t.slice(0, 500)}`)
		;(
			err as Error & {
				httpStatus: number
				bodySnippet: string
				retryAfterHeader: string | null
			}
		).httpStatus = res.status
		;(err as Error & { bodySnippet: string }).bodySnippet = t.slice(0, 800)
		;(err as Error & { retryAfterHeader: string | null }).retryAfterHeader =
			res.headers.get("retry-after")
		throw err
	}

	const json = (await res.json()) as {
		choices?: { message?: { content?: string } }[]
		error?: { message?: string }
	}
	if (json.error?.message)
		throw new Error(`openrouter_api_error: ${json.error.message}`)
	const content = json.choices?.[0]?.message?.content?.trim()
	if (!content) throw new Error("openrouter_empty_response")
	return content
}

function isHttpErr(e: unknown): e is Error & {
	httpStatus: number
	bodySnippet: string
	retryAfterHeader: string | null
} {
	return e instanceof Error && "httpStatus" in e
}

function shouldRotate(status: number): boolean {
	return (
		status === 429 ||
		status === 401 ||
		status === 403 ||
		status === 408 ||
		status === 503 ||
		(status >= 500 && status < 600)
	)
}

async function callGeminiText(
	key: ProcessorProviderKey,
	system: string,
	user: string,
): Promise<string> {
	const modelId = key.modelId?.trim() || GEMINI_DEFAULT_MODEL
	const res = await fetch(
		`${GEMINI_BASE}/models/${modelId}:generateContent?key=${key.secret}`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				system_instruction: { parts: [{ text: system }] },
				contents: [{ role: "user", parts: [{ text: user }] }],
				generationConfig: {
					temperature: 0.7,
					maxOutputTokens: 8192,
					responseMimeType: "application/json",
				},
			}),
			signal: AbortSignal.timeout(120_000),
		},
	)

	if (!res.ok) {
		const t = await res.text().catch(() => "")
		throw new Error(`gemini_${res.status}:${t.slice(0, 500)}`)
	}

	const json = (await res.json()) as {
		candidates?: { content?: { parts?: { text?: string }[] } }[]
		error?: { message?: string }
	}
	if (json.error?.message)
		throw new Error(`gemini_api_error: ${json.error.message}`)
	const content = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
	if (!content) throw new Error("gemini_empty_response")
	return content
}

/**
 * Generates script text: OpenRouter primary (key rotation + model chain fallback),
 * then Gemini direct API as fallback if all OpenRouter keys exhausted or unavailable.
 */
export async function generateScript(spec: ProcessorJobSpec): Promise<string> {
	const {
		openrouterScriptModels: models,
		scriptSystemPrompt: system,
		scriptUserPrompt: user,
	} = spec

	let lastError: unknown

	// Primary: OpenRouter — rotate keys, OpenRouter handles model fallback internally.
	for (const key of spec.providerKeys.openrouter) {
		try {
			return await withTiming("script-gen", "openrouter.call", () =>
				callOpenRouterText(key, models, system, user),
			)
		} catch (e) {
			lastError = e
			if (isHttpErr(e) && shouldRotate(e.httpStatus)) {
				await reportKeyFailure(
					spec,
					"openrouter",
					key.id,
					e.httpStatus,
					e.bodySnippet,
					e.retryAfterHeader,
				)
			}
			// Continue to next key regardless — fall through to Gemini when exhausted.
		}
	}

	// Fallback: Gemini direct API (gemini-2.5-flash-lite-preview or per-key modelId).
	for (const key of spec.providerKeys.gemini) {
		try {
			return await withTiming("script-gen", "gemini.call", () =>
				callGeminiText(key, system, user),
			)
		} catch (e) {
			lastError = e
		}
	}

	throw lastError ?? new Error("script_generation_all_failed")
}
