/**
 * Klipse AI routing — single source of truth for provider selection.
 *
 * **Stack:**
 * - Script:  OpenRouter (primary, free models) → Gemini (secondary) → Pollinations (last resort)
 * - Images:  Pollinations Flux (only free option)
 * - TTS:     Google Cloud TTS (primary, free 4M chars/month) → Pollinations Audio (last resort)
 *
 * OpenRouter free models (configure via OPENROUTER_SCRIPT_MODEL):
 *   - openrouter/free  (default — auto-selects best available free model)
 *   - nvidia/nemotron-3-super:free
 *   - arceeai/arcee-trinity-large-preview:free
 *   - openai/gpt-oss-120b:free
 *
 * Future premium tiers can branch in `resolveAiRoutingTier` (`ai-routing-policy.server.ts`)
 * without changing provider modules.
 *
 * Provider docs:
 * - OpenRouter:   https://openrouter.ai/docs
 * - Gemini:       https://ai.google.dev/gemini-api/docs/quickstart
 * - Pollinations: https://text.pollinations.ai / https://image.pollinations.ai / https://audio.pollinations.ai
 * - Google TTS:   https://cloud.google.com/text-to-speech/docs/reference/rest/v1/text/synthesize
 */

export const AI_TASK = {
	script: "script",
	image: "image",
	tts: "tts",
} as const;

export type AiTask = (typeof AI_TASK)[keyof typeof AI_TASK];

/** Defaults — override with env vars where supported. */
export const DEFAULT_MODEL_IDS = {
	/** OpenRouter model for script generation (primary). @default nvidia/nemotron-3-super:free */
	openRouterScript: "openrouter/free",
	/** Gemini model for script generation (secondary). @default gemini-2.5-flash-lite */
	geminiScript: "gemini-2.5-flash-lite",
	/** Pollinations text model (last resort). @default mistral */
	pollinationsText: "mistral",
	/** Pollinations image model. @default flux */
	pollinationsImage: "flux",
	/** Pollinations TTS voice (last resort). @default alloy */
	pollinationsTtsVoice: "alloy",
	/** Google Cloud TTS voice. @default en-US-Chirp-HD-F */
	googleTtsVoice: "en-US-Chirp-HD-F",
} as const;

export type RoutingRow = {
	task: string;
	primary: string;
	secondary?: string;
	fallback: string;
};

/** Provider matrix shown in system prompts so the model doesn't hallucinate a different stack. */
export const MODEL_ROUTING_TABLE: RoutingRow[] = [
	{
		task: "Script",
		primary: "OpenRouter (Nemotron / GPT-class)",
		secondary: "Gemini 2.5 Flash Lite",
		fallback: "Pollinations (Mistral-class)",
	},
	{
		task: "Images",
		primary: "Pollinations (Flux)",
		fallback: "—",
	},
	{
		task: "TTS",
		primary: "Google Cloud TTS",
		fallback: "Pollinations Audio",
	},
];

export function pipelineModelContextBlock(): string {
	const lines = MODEL_ROUTING_TABLE.map((r) => {
		if (r.fallback === "—") return `- ${r.task}: ${r.primary}.`;
		const chain = [r.primary, r.secondary, r.fallback]
			.filter(Boolean)
			.join(" → ");
		return `- ${r.task}: ${chain}.`;
	});
	return [
		"## AI routing (do not claim a different vendor stack)",
		...lines,
	].join("\n");
}
