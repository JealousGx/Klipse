/** Per-key credential forwarded from main app to processor (sourced from `provider_api_keys` DB). */
export type ProcessorProviderKey = {
	/** DB row ID — echoed back in key-failure callbacks so main app can update cooldown. */
	id: string;
	secret: string;
	/** Per-key model override (e.g. a specific Gemini or OpenRouter model). */
	modelId: string | null;
};

/** All provider key sets included in a ProcessorJobSpec. */
export type ProcessorProviderKeys = {
	openrouter: ProcessorProviderKey[];
	googleTts: ProcessorProviderKey[];
	replicate: ProcessorProviderKey[];
	unrealSpeech: ProcessorProviderKey[];
	elevenlabs: ProcessorProviderKey[];
	/** Gemini keys — used as script generation fallback when OpenRouter exhausted. */
	gemini: ProcessorProviderKey[];
};

/** Pre-generated presigned PUT URL (1h TTL) for the processor to upload the final video to R2. */
export type ProcessorPresignedUrls = {
	outputVideo: string;
};

/**
 * Full job spec sent from the main app to the external processor (Cloud Run).
 * Contains pre-built prompts, provider credentials, and presigned R2 upload URLs.
 * The processor does: script → TTS + images + sound → FFmpeg → R2 upload → callback.
 */
export type ProcessorJobSpec = {
	jobId: string;
	userId: string;
	channelId: string;
	/** Pre-built OpenRouter system prompt (from main app prompt builder). */
	scriptSystemPrompt: string;
	/** Pre-built OpenRouter user prompt (from main app prompt builder). */
	scriptUserPrompt: string;
	/** Model chain for OpenRouter text completions (primary + fallbacks in order). */
	openrouterScriptModels: string[];
	/** Unreal Speech voice ID (Google TTS uses env default on processor). */
	ttsVoice: string;
	targetDuration: number;
	aspectRatio: "16:9" | "9:16" | "1:1";
	/** Non-null = generate sound with this prompt; null = skip sound entirely. */
	soundPrompt: string | null;
	/** Duration to pass to ElevenLabs (capped at 22s). */
	soundDurationSeconds: number;
	freeTierWatermark: boolean;
	watermarkLabel: string;
	providerKeys: ProcessorProviderKeys;
	presignedUrls: ProcessorPresignedUrls;
	/** App base URL for processor → main app callbacks (e.g. https://app.example.com). */
	callbackBaseUrl: string;
	/** Shared secret for authenticating callbacks (same as VIDEO_PROCESSOR_WEBHOOK_SECRET). */
	callbackSecret: string;
};
