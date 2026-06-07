import "@tanstack/react-start/server-only"

import { eq } from "drizzle-orm"

import { users } from "@/db/schema/users"
import type { CreditUsageTx } from "@/features/billing/credit-usage.server"
import type { MeResponse } from "@/features/user/types/me"

/**
 * Read-only user fields needed for entitlement checks. Loaded under `FOR UPDATE` inside a transaction.
 */
export type UserEntitlementSnapshot = {
	readonly plan: MeResponse["plan"]
	readonly freeVideoConsumed: boolean
	readonly creditsRemaining: number
	readonly creditsUsed: number
}

export async function selectUserEntitlementSnapshotForUpdate(
	tx: CreditUsageTx,
	userId: string,
): Promise<UserEntitlementSnapshot | null> {
	const [row] = await tx
		.select({
			plan: users.plan,
			freeVideoConsumed: users.freeVideoConsumed,
			creditsRemaining: users.creditsRemaining,
			creditsUsed: users.creditsUsed,
		})
		.from(users)
		.where(eq(users.id, userId))
		.for("update")

	if (!row) {
		return null
	}

	return {
		plan: row.plan as MeResponse["plan"],
		freeVideoConsumed: row.freeVideoConsumed,
		creditsRemaining: row.creditsRemaining,
		creditsUsed: row.creditsUsed,
	}
}
