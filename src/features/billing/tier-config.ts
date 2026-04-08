import type { MeResponse } from "@/features/user/types/me";

/**
 * Max channels per plan (FEATURE_DOC §10.3). Free gets one workspace for onboarding.
 */
export const MAX_CHANNELS_BY_PLAN: Record<MeResponse["plan"], number> = {
	free: 1,
	starter: 1,
	creator: 3,
	empire: 20,
};

/**
 * Max destination **replacements** (switch to a different linked account on an
 * already-used slot—any publishing platform) per billing cycle. Free: paid
 * publishing connections disallowed; value is 0. Resets via Polar webhooks.
 */
export const DESTINATION_REPLACEMENTS_PER_BILLING_CYCLE_BY_PLAN: Record<
	MeResponse["plan"],
	number
> = {
	free: 0,
	starter: 1,
	creator: 5,
	empire: 30,
};

export function maxDestinationReplacementsPerCycle(
	plan: MeResponse["plan"],
): number {
	return DESTINATION_REPLACEMENTS_PER_BILLING_CYCLE_BY_PLAN[plan];
}

/**
 * Free tier is generate-only. Connecting any paid publishing destination
 * (YouTube today; TikTok / Instagram later) requires a paid plan.
 */
export function planAllowsPaidPublishingConnections(
	plan: MeResponse["plan"],
): boolean {
	return plan !== "free";
}

/**
 * Internal credit budgets per paid tier (FEATURE_DOC §10.3).
 * UI should emphasize videos/month; credits stay server-side for metering.
 */
export const MONTHLY_CREDITS_BY_PLAN = {
	starter: 1500,
	creator: 5000,
	empire: 15000,
} as const;

/**
 * Fast-forward (trigger schedule immediately) is gated to Creator+ plans.
 * Free/Starter users must wait for the next scheduled run.
 */
export function planAllowsScheduleFastForward(
	plan: MeResponse["plan"],
): boolean {
	return plan === "creator" || plan === "empire";
}

/**
 * AI background sound generation is gated to Creator+ plans.
 * Requires ElevenLabs API keys configured by an admin.
 */
export function planAllowsSoundGeneration(plan: MeResponse["plan"]): boolean {
	return plan === "creator" || plan === "empire";
}

/** One-time credit packs (FEATURE_DOC §10.4). */
export const CREDIT_ADDON_AMOUNTS = {
	small: 750,
	large: 2000,
} as const;
