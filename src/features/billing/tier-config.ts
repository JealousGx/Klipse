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
