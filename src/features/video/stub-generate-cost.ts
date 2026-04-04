import {
	CREDIT_COSTS,
	creditsForTtsChars,
} from "@/features/billing/credit-costs";

/**
 * Placeholder estimate for the dashboard stub until `POST /api/videos/generate` exists.
 * Mirrors a minimal pipeline: script + a few images + short TTS + assembly.
 */
export function estimateStubGenerateCredits(): number {
	return (
		CREDIT_COSTS.scriptGeneration +
		CREDIT_COSTS.videoAssembly +
		creditsForTtsChars(800) +
		CREDIT_COSTS.imagePerImage * 3
	);
}
