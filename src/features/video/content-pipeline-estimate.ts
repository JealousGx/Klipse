import { CREDIT_COSTS } from "@/features/billing/credit-costs";

/** Script (§10.2) + video assembly credits for one content pipeline job. */
export function estimateContentPipelineCredits(): number {
	return CREDIT_COSTS.scriptGeneration + CREDIT_COSTS.videoAssembly;
}
