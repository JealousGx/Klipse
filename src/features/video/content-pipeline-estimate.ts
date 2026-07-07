import {
	CREDIT_COSTS,
	creditsForAiVideoSeconds,
} from "@/features/billing/credit-costs"

/**
 * Script generation + single-call self-hosted video+audio generation (FEATURE_DOC §10.2).
 * Replaces the old image/TTS/assembly line items — one model call now covers everything
 * that used to be three separate provider calls.
 */
export function estimateContentPipelineCredits(input: {
	targetDuration: number
}): number {
	return (
		CREDIT_COSTS.scriptGeneration +
		creditsForAiVideoSeconds(input.targetDuration)
	)
}
