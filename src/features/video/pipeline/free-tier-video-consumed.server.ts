import "@tanstack/react-start/server-only"

import { eq } from "drizzle-orm"

import { getDb } from "@/db"
import { users } from "@/db/schema/users"
import { logger } from "@/lib/logger"

/** After a successful assembled output, mark one-time free-plan consumption (`free_video_consumed`). */
export async function markFreeTierVideoConsumedIfNeeded(
	userId: string,
): Promise<void> {
	const db = getDb()
	const [u] = await db
		.select({ plan: users.plan, consumed: users.freeVideoConsumed })
		.from(users)
		.where(eq(users.id, userId))
		.limit(1)

	if (!u || u.plan !== "free" || u.consumed) {
		return
	}

	await db
		.update(users)
		.set({
			freeVideoConsumed: true,
			updatedAt: new Date(),
		})
		.where(eq(users.id, userId))

	logger.info("free_tier_video_consumed", { userId })
}
