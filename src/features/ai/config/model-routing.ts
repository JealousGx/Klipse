/**
 * Klipse AI routing (single source of truth for prompts + implementation).
 *
 * **Matrix:** Primary → Fallback only. Future **premium (paid)** tiers can branch in
 * `resolveAiRoutingTier` (`ai-routing-policy.server.ts`) without changing provider modules.
 *
 * Docs (implementations under `src/features/ai/providers/`):
 * - Pollinations: https://enter.pollinations.ai/api/docs/llm.txt
 * - Gemini: https://ai.google.dev/gemini-api/docs/quickstart
 * - OpenAI Images: https://platform.openai.com/docs/api-reference/images
 * - Google Cloud TTS: https://cloud.google.com/text-to-speech/docs/reference/rest
 * - Luma: https://docs.lumalabs.ai/docs/video-generation
 * - Kling: set `KLING_API_BASE` to your vendor’s API host.
 */

export const AI_TASK = {
	script: "script",
	image: "image",
	video: "video",
	tts: "tts",
} as const;

export type AiTask = (typeof AI_TASK)[keyof typeof AI_TASK];

/** Defaults — override with env vars where supported. */
export const DEFAULT_MODEL_IDS = {
	/** Pollinations `POST …/v1/chat/completions` — Claude/Mistral-class ids from Pollinations model list. */
	pollinationsText: "mistral",
	geminiScript: "gemini-2.5-flash",
	pollinationsImage: "flux",
	openaiImage: "dall-e-3",
	pollinationsVideo: "wan-fast",
	/** Kling task type — confirm with your API vendor. */
	klingVideo: "pro-text-to-video",
	lumaVideo: "ray-flash-2",
	pollinationsTtsVoice: "nova",
	googleTtsVoice: "en-US-Neural2-A",
} as const;

export type RoutingRow = {
	task: string;
	primary: string;
	fallback: string;
};

/** Product matrix: Primary → Fallback (same order for all users until premium is implemented). */
export const MODEL_ROUTING_TABLE: RoutingRow[] = [
	{
		task: "Script",
		primary: "Pollinations (Claude / Mistral-class)",
		fallback: "Gemini 2.5 Flash",
	},
	{
		task: "Images",
		primary: "Pollinations (Flux / SDXL-class)",
		fallback: "DALL·E 3",
	},
	{
		task: "Video",
		primary: "Pollinations (Wan-Fast)",
		fallback: "Kling 3.0 → Luma",
	},
	{
		task: "TTS",
		primary: "Pollinations Audio",
		fallback: "Google TTS",
	},
];

export function pipelineModelContextBlock(): string {
	const lines = MODEL_ROUTING_TABLE.map(
		(r) => `- ${r.task}: primary ${r.primary}; fallback ${r.fallback}.`,
	);
	return [
		"## Klipse AI routing (do not claim a different vendor stack)",
		...lines,
		"Script: Pollinations first, then Gemini 2.5 Flash. Prompts target niche fit, retention, and engagement on the connected destination.",
	].join("\n");
}
