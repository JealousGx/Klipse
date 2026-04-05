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
 * Internal credit budgets per paid tier (FEATURE_DOC §10.3).
 * UI should emphasize videos/month; credits stay server-side for metering.
 */
export const MONTHLY_CREDITS_BY_PLAN = {
	starter: 1000,
	creator: 5000,
	empire: 15000,
} as const;

/** One-time credit packs (FEATURE_DOC §10.4). */
export const CREDIT_ADDON_AMOUNTS = {
	small: 1000,
	large: 3000,
} as const;
