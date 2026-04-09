/**
 * Klipse AI routing — single source of truth for provider selection.
 *
 * **Stack:**
 * - Script:  Gemini 2.0 Flash (primary, free 1500 req/day) → Pollinations text (fallback, free)
 * - Images:  Pollinations Flux (free, no key required)
 * - TTS:     Google Cloud TTS (primary, free 4M chars/month) → Pollinations Audio (fallback, free)
 *
 * Future premium tiers can branch in `resolveAiRoutingTier` (`ai-routing-policy.server.ts`)
 * without changing provider modules.
 *
 * Provider docs:
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
	/** Gemini model for script generation. @default gemini-2.5-flash-lite */
	geminiScript: "gemini-2.5-flash-lite",
	/** Pollinations text model. @default mistral */
	pollinationsText: "mistral",
	/** Pollinations image model. @default flux */
	pollinationsImage: "flux",
	/** Pollinations TTS voice (fallback). @default alloy */
	pollinationsTtsVoice: "alloy",
	/** Google Cloud TTS voice. @default en-US-Chirp-HD-F */
	googleTtsVoice: "en-US-Chirp-HD-F",
} as const;

export type RoutingRow = {
	task: string;
	primary: string;
	fallback: string;
};

/** Provider matrix shown in system prompts so the model doesn't hallucinate a different stack. */
export const MODEL_ROUTING_TABLE: RoutingRow[] = [
	{
		task: "Script",
		primary: "Gemini 2.0 Flash",
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
	const lines = MODEL_ROUTING_TABLE.map((r) =>
		r.fallback === "—"
			? `- ${r.task}: ${r.primary}.`
			: `- ${r.task}: primary ${r.primary}; fallback ${r.fallback}.`,
	);
	return [
		"## AI routing (do not claim a different vendor stack)",
		...lines,
	].join("\n");
}
