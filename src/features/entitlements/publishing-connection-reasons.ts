/**
 * Stable machine-readable codes for publishing-connection policy (redirects, OAuth callbacks, toasts).
 * Add new keys here as you support more integrations (TikTok, Instagram, etc.) — avoid vendor-specific names
 * for cross-cutting rules like plan gates.
 */
export const PUBLISHING_CONNECTION_DENIAL_REASONS = {
	/** OAuth / destination linking for paid publishing surfaces requires a paid plan. */
	PAID_PLAN_REQUIRED: "publishing_connection_requires_paid_plan",
} as const;

export type PublishingConnectionDenialReason =
	(typeof PUBLISHING_CONNECTION_DENIAL_REASONS)[keyof typeof PUBLISHING_CONNECTION_DENIAL_REASONS];
