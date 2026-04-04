/**
 * Single Polar Usage Billing event — one meter filters **Name → equals → `POLAR_USAGE_EVENT_NAME`**.
 *
 * **Credits vs Count:** Internal credits vary by stage (see `credit-costs.ts`). In Polar, use
 * **Aggregation → Sum** on metadata property **`credits`** (not Count): each ingest carries
 * `metadata.credits` so the meter total matches DB deductions.
 *
 * Optional `metadata.stage` (`POLAR_USAGE_STAGES`) helps dashboards; it does not change the Sum.
 */
export const POLAR_USAGE_EVENT_NAME = "klipse.usage" as const;

export type PolarUsageEventName = typeof POLAR_USAGE_EVENT_NAME;

/** Metadata key Polar uses when the meter uses Sum — select this property in the dashboard. */
export const POLAR_USAGE_CREDITS_METADATA_KEY = "credits" as const;

/** Optional labels for `metadata.stage`. */
export const POLAR_USAGE_STAGES = {
	scriptGeneration: "script",
	imageGeneration: "image",
	tts: "tts",
	videoAssembly: "assembly",
	aiVideoSecond: "ai_video",
	/** Dashboard stub until real video pipeline metering exists. */
	stubGenerate: "stub",
} as const;

/**
 * Metadata for `klipse.usage` events. **`credits`** is summed by the Polar meter (Sum aggregation).
 */
export type PolarUsageMetadata = {
	credits: number;
	stage?: (typeof POLAR_USAGE_STAGES)[keyof typeof POLAR_USAGE_STAGES];
	/** Correlation — job id, request id, etc. */
	ref?: string;
};
