import "@tanstack/react-start/server-only"

import { planAllowsPaidPublishingConnections } from "@/features/billing/tier-config"
import type { MeResponse } from "@/features/user/types/me"

import {
	PUBLISHING_CONNECTION_DENIAL_REASONS,
	type PublishingConnectionDenialReason,
} from "./publishing-connection-reasons"

/**
 * Paid publishing integrations (any platform) are blocked on the free plan.
 * Returns a stable reason code for redirects / API errors, or `null` if allowed.
 */
export function getPublishingConnectionDenialReason(
	plan: MeResponse["plan"],
): PublishingConnectionDenialReason | null {
	return planAllowsPaidPublishingConnections(plan)
		? null
		: PUBLISHING_CONNECTION_DENIAL_REASONS.PAID_PLAN_REQUIRED
}
