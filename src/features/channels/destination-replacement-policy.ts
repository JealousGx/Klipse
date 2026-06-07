import type { MeResponse } from "@/features/user/types/me"

/**
 * Minimal slice of a `channels` row used to resolve the previously linked
 * platform account id.
 */
export type DestinationExternalIdentitySlice = {
	boundExternalAccountId: string | null
	externalChannelId: string | null
}

/**
 * Previously linked platform external id for this destination.
 * Bound id wins when present.
 */
export function priorExternalChannelIdFromDestinationRow(
	input: DestinationExternalIdentitySlice,
): string | null {
	const b = input.boundExternalAccountId?.trim()
	const e = input.externalChannelId?.trim()
	return b || e || null
}

/**
 * Whether this connect should decrement the per–billing-cycle **destination
 * replacement** budget (account-wide). True only when switching to a
 * **different** external id on a slot that already had one. Same rules for any
 * publishing platform.
 */
export function consumesDestinationReplacementQuota(input: {
	plan: MeResponse["plan"]
	priorExternalChannelId: string | null
	newExternalChannelId: string
}): boolean {
	if (input.plan === "free") {
		return false
	}
	const prior = input.priorExternalChannelId?.trim() || null
	if (!prior) {
		return false
	}
	return prior !== input.newExternalChannelId.trim()
}
