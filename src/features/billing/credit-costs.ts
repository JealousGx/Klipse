/**
 * Internal credit costs per operation (FEATURE_DOC §10.2).
 * Use these when deducting DB credits and when setting `metadata.credits` on Polar `klipse.usage` ingests
 * so the meter **Sum** matches your app.
 */
export const CREDIT_COSTS = {
	scriptGeneration: 5,
	/** Per second of self-hosted AI video generation (covers video + native audio in one call). */
	aiVideoPerSecond: 3,
} as const

export function creditsForAiVideoSeconds(seconds: number): number {
	if (seconds <= 0) {
		return 0
	}
	return Math.ceil(seconds) * CREDIT_COSTS.aiVideoPerSecond
}
