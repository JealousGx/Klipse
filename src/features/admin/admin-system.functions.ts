import { createServerFn } from "@tanstack/react-start"
import { getRequest } from "@tanstack/react-start/server"

import { getSystemStats } from "@/features/admin/admin-system.server"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProviderKeyHealth = {
	provider: string
	total: number
	active: number
	disabled: number
	cooling: number
}

export type SystemStats = {
	totalUsers: number
	newUsersLast7Days: number
	activeJobsNow: number
	jobsLast24h: number
	failedJobsLast24h: number
	providerHealth: ProviderKeyHealth[]
	recentErrors: Array<{
		id: string
		userEmail: string | null
		errorMessage: string | null
		createdAt: Date
	}>
}

// ---------------------------------------------------------------------------
// getSystemStatsFn
// ---------------------------------------------------------------------------

export type GetSystemStatsResult =
	| { ok: true; stats: SystemStats }
	| { ok: false; code: "unauthorized" }

export const getSystemStatsFn = createServerFn({ method: "GET" }).handler(
	async (): Promise<GetSystemStatsResult> => {
		return getSystemStats(getRequest())
	},
)
