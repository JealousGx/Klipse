import {
	CREDIT_COSTS,
	creditsForImages,
	creditsForTtsChars,
} from "@/features/billing/credit-costs"

/** Matches {@link resolvePrepareRefs}: three Pollinations image URLs. */
const PREPARE_IMAGE_COUNT = 3

/**
 * Script + prepare (images + TTS URLs) + assembly (§10.2).
 * `idea` length scales the TTS credit estimate (rough upper bound on spoken length).
 */
export function estimateContentPipelineCredits(input?: {
	idea?: string
}): number {
	const ideaLen = input?.idea?.trim().length ?? 0
	const ttsChars = Math.min(Math.max(ideaLen * 4, 400), 12_000)
	return (
		CREDIT_COSTS.scriptGeneration +
		creditsForImages(PREPARE_IMAGE_COUNT) +
		creditsForTtsChars(ttsChars) +
		CREDIT_COSTS.videoAssembly
	)
}
