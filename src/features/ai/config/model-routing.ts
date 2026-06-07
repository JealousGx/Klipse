/**
 * Klipse AI routing — single source of truth for provider selection.
 *
 * **Stack:**
 * - Script:  OpenRouter single call — `models[]` array, OpenRouter handles provider
 *            fallback internally. No manual retry chain needed.
 * - Images:  OpenRouter FLUX.2 (free) → Replicate FLUX Schnell (~$0.003/img)
 * - TTS:     Google Cloud TTS (1M Neural2 chars/month free) → Unreal Speech (250K/month free)
 *
 * OpenRouter model chain (all configurable via env):
 *   Primary:   OPENROUTER_SCRIPT_MODEL            (default: openrouter/free)
 *   Fallbacks: OPENROUTER_SCRIPT_FALLBACK_MODELS  (default: google/gemini-2.5-flash,meta-llama/llama-4-scout:free)
 *
 * Provider docs:
 * - OpenRouter:    https://openrouter.ai/docs
 * - Google TTS:    https://cloud.google.com/text-to-speech
 * - Replicate:     https://replicate.com/black-forest-labs/flux-schnell
 * - Unreal Speech: https://docs.unrealspeech.com
 */

import { env } from "@/env"

export const AI_TASK = {
	script: "script",
	image: "image",
	tts: "tts",
} as const

export type AiTask = (typeof AI_TASK)[keyof typeof AI_TASK]

/** Defaults — all overridable via env vars. */
export const DEFAULT_MODEL_IDS = {
	/** OpenRouter auto-router — picks best available free model per request. */
	openRouterScript: "openrouter/free",
	/** OpenRouter FLUX.2 Pro — currently free. */
	openRouterImage: "black-forest-labs/flux.2-pro",
	/** Google Cloud TTS default voice (Chirp HD = highest quality free tier). */
	googleTtsVoice: "en-US-Wavenet-G",
	/** Unreal Speech default voice. Options: Scarlett | Dan | Liv | Will | Amy */
	unrealSpeechVoice: "Scarlett",
} as const

/**
 * Builds the OpenRouter `models[]` array for script generation:
 * [primaryModel, ...fallbackModels]
 *
 * OpenRouter tries them in order if a model fails (context too long,
 * content filter, rate limit, etc.). All handled server-side by OpenRouter.
 *
 * @param overridePrimary - per-key `modelId` from the DB, takes highest precedence.
 */
export function buildOpenRouterModelChain(
	overridePrimary?: string | null,
): string[] {
	const primary =
		overridePrimary?.trim() ||
		env.OPENROUTER_SCRIPT_MODEL?.trim() ||
		DEFAULT_MODEL_IDS.openRouterScript

	const fallbacks = (env.OPENROUTER_SCRIPT_FALLBACK_MODELS ?? "")
		.split(",")
		.map((m) => m.trim())
		.filter(Boolean)
		.filter((m) => m !== primary)

	return [primary, ...fallbacks]
}

/** Injected into system prompts so the LLM knows what stack generated it. */
export function pipelineModelContextBlock(): string {
	const primary =
		env.OPENROUTER_SCRIPT_MODEL?.trim() || DEFAULT_MODEL_IDS.openRouterScript
	const fallbacks =
		env.OPENROUTER_SCRIPT_FALLBACK_MODELS?.trim() ||
		"google/gemini-2.5-flash,meta-llama/llama-4-scout:free"

	return [
		"## AI routing (do not claim a different vendor stack)",
		`- Script: OpenRouter (${primary} → ${fallbacks}).`,
		`- Images: OpenRouter FLUX.2 → Replicate FLUX Schnell.`,
		`- TTS: Google Cloud TTS → Unreal Speech.`,
	].join("\n")
}
