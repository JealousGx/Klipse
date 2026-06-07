import { desc, eq, gte, sql } from "drizzle-orm"

import { getDb } from "@/db"
import { providerApiKeys } from "@/db/schema/provider-api-keys"
import { users } from "@/db/schema/users"
import { videoJobs } from "@/db/schema/video-jobs"
import { requireAdmin } from "@/features/admin/admin.guard.server"

import type {
	ProviderKeyHealth,
	SystemStats,
} from "@/features/admin/admin-system.functions"

// ---------------------------------------------------------------------------
// getSystemStats
// ---------------------------------------------------------------------------

export async function getSystemStats(
	request: Request,
): Promise<
	{ ok: true; stats: SystemStats } | { ok: false; code: "unauthorized" }
> {
	try {
		await requireAdmin(request)
	} catch {
		return { ok: false, code: "unauthorized" }
	}

	const db = getDb()
	const now = new Date()
	const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1_000)
	const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1_000)

	// ── User counts ───────────────────────────────────────────────────────
	const [totalUsersRow] = await db
		.select({ count: sql<number>`COUNT(*)` })
		.from(users)

	const [newUsersRow] = await db
		.select({ count: sql<number>`COUNT(*)` })
		.from(users)
		.where(gte(users.createdAt, sevenDaysAgo))

	// ── Job counts ────────────────────────────────────────────────────────
	const [activeJobsRow] = await db
		.select({ count: sql<number>`COUNT(*)` })
		.from(videoJobs)
		.where(sql`${videoJobs.status} IN ('queued', 'dispatched', 'processing')`)

	const [jobsLast24hRow] = await db
		.select({ count: sql<number>`COUNT(*)` })
		.from(videoJobs)
		.where(gte(videoJobs.createdAt, oneDayAgo))

	const [failedLast24hRow] = await db
		.select({ count: sql<number>`COUNT(*)` })
		.from(videoJobs)
		.where(
			sql`${videoJobs.status} = 'failed' AND ${videoJobs.updatedAt} >= ${oneDayAgo}`,
		)

	// ── Provider key health ───────────────────────────────────────────────
	const keyRows = await db.select().from(providerApiKeys)

	const healthMap = new Map<string, ProviderKeyHealth>()
	for (const key of keyRows) {
		if (!healthMap.has(key.provider)) {
			healthMap.set(key.provider, {
				provider: key.provider,
				total: 0,
				active: 0,
				disabled: 0,
				cooling: 0,
			})
		}
		const h = healthMap.get(key.provider) as ProviderKeyHealth
		h.total += 1
		if (key.disabled) {
			h.disabled += 1
		} else if (key.cooldownUntil && new Date(key.cooldownUntil) > now) {
			h.cooling += 1
		} else {
			h.active += 1
		}
	}

	// ── Recent failures ───────────────────────────────────────────────────
	const recentErrorRows = await db
		.select({
			id: videoJobs.id,
			userEmail: users.email,
			errorMessage: videoJobs.errorMessage,
			createdAt: videoJobs.createdAt,
		})
		.from(videoJobs)
		.leftJoin(users, eq(videoJobs.userId, users.id))
		.where(eq(videoJobs.status, "failed"))
		.orderBy(desc(videoJobs.updatedAt))
		.limit(10)

	return {
		ok: true,
		stats: {
			totalUsers: Number(totalUsersRow?.count ?? 0),
			newUsersLast7Days: Number(newUsersRow?.count ?? 0),
			activeJobsNow: Number(activeJobsRow?.count ?? 0),
			jobsLast24h: Number(jobsLast24hRow?.count ?? 0),
			failedJobsLast24h: Number(failedLast24hRow?.count ?? 0),
			providerHealth: Array.from(healthMap.values()),
			recentErrors: recentErrorRows.map((r) => ({
				id: r.id,
				userEmail: r.userEmail ?? null,
				errorMessage: r.errorMessage ?? null,
				createdAt: r.createdAt,
			})),
		},
	}
}
