/** Processor → main app: pipeline stage progress update. */
export type ProcessorProgressPayload = {
	jobId: string;
	stage: "script" | "prepare" | "assemble";
	/** Progress percentage 0–100 within this stage. */
	progress: number;
};

export type ProcessorKeyFailureProvider =
	| "openrouter"
	| "google_tts"
	| "replicate"
	| "unreal_speech"
	| "elevenlabs";

/**
 * Processor → main app: a provider key failed.
 * Main app looks up the key by `keyId`, runs failure classification, and updates DB cooldown.
 */
export type ProcessorKeyFailurePayload = {
	jobId: string;
	provider: ProcessorKeyFailureProvider;
	/** DB row ID from `provider_api_keys` — used to update cooldown on the correct row. */
	keyId: string;
	httpStatus: number;
	/** First 800 chars of response body — for quota/billing detection. */
	bodySnippet: string;
	/** Raw `retry-after` header value (may be seconds or HTTP date); null if absent. */
	retryAfterHeader: string | null;
};

/** Processor → main app: terminal result for the job. */
export type ProcessorCompletePayload = {
	jobId: string;
	userId: string;
	status: "completed" | "failed";
	error?: string;
	/** Generated script text — present on success, absent on failure. */
	scriptText?: string;
};
