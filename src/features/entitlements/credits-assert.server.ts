import "@tanstack/react-start/server-only";

import { InsufficientCreditsError } from "@/features/billing/credit-usage.server";

import type { UserEntitlementSnapshot } from "./snapshot.server";

/**
 * Throws {@link InsufficientCreditsError} when the locked snapshot cannot cover `requiredCredits`.
 * Use with {@link selectUserEntitlementSnapshotForUpdate} for preflight checks outside
 * {@link applyUsageDeduction} (e.g. validation-only paths).
 */
export function assertCreditsSufficientForCharge(
	snapshot: Pick<UserEntitlementSnapshot, "creditsRemaining">,
	requiredCredits: number,
): void {
	if (requiredCredits <= 0) {
		throw new Error("requiredCredits must be positive");
	}
	if (snapshot.creditsRemaining < requiredCredits) {
		throw new InsufficientCreditsError(
			requiredCredits,
			snapshot.creditsRemaining,
		);
	}
}
