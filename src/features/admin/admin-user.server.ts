import { and, desc, eq, like, lt, or, sql } from "drizzle-orm"

import { getDb } from "@/db"
import { users } from "@/db/schema/users"
import { requireAdmin } from "@/features/admin/admin.guard.server"
import type {
	AdjustUserCreditsInput,
	AdminUserRow,
	BanUserInput,
	ChangePlanInput,
	CreateUserInput,
	ListAdminUsersInput,
	SetRoleInput,
} from "@/features/admin/admin-user.functions"
import { auth } from "@/lib/auth"
import { runAsAdminCreate } from "@/lib/auth/admin-create-context"
import { sendAdminInviteEmail } from "@/lib/email/admin-invite"
import { logger } from "@/lib/logger"

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

function toAdminUserRow(r: typeof users.$inferSelect): AdminUserRow {
	return {
		id: r.id,
		name: r.name,
		email: r.email,
		role: r.role ?? "user",
		plan: r.plan,
		creditsRemaining: r.creditsRemaining,
		banned: r.banned ?? false,
		banReason: r.banReason ?? null,
		createdAt: r.createdAt,
	}
}

// ---------------------------------------------------------------------------
// createUserAsAdmin
// ---------------------------------------------------------------------------

/**
 * Creates a new user account on behalf of an admin, bypassing the public
 * registration kill switch, then sends an invite email to the new user.
 *
 * User creation flows through Better Auth (auth.api.createUser) so all
 * databaseHooks fire normally — the admin plugin sets the role, and the
 * after hook creates the Polar customer. The only hook skipped is the
 * registration kill switch, which is bypassed via AsyncLocalStorage.
 *
 * The invite email is awaited but its failure is non-fatal — the account
 * is already live and the error is logged.
 */
export async function createUserAsAdmin(
	request: Request,
	data: CreateUserInput,
): Promise<
	| { ok: true; userId: string }
	| { ok: false; code: "unauthorized" | "email_taken" | "failed" }
> {
	let adminInfo: { userId: string; email: string; name: string }
	try {
		adminInfo = await requireAdmin(request)
	} catch {
		return { ok: false, code: "unauthorized" }
	}

	let userId: string

	try {
		const result = await runAsAdminCreate(() =>
			// password is optional in the admin plugin — omitted intentionally.
			// Users authenticate via email OTP only; no password is ever set or needed.
			auth.api.createUser({
				body: {
					email: data.email,
					name: data.name,
					role: "user",
				},
				headers: request.headers,
			}),
		)
		userId = result.user.id
	} catch (e) {
		const msg = String(e)
		// Drizzle/MySQL duplicate key (ER_DUP_ENTRY = 1062) or Better Auth error
		if (
			msg.includes("already exists") ||
			msg.includes("1062") ||
			msg.includes("Duplicate entry")
		) {
			return { ok: false, code: "email_taken" }
		}
		logger.error("admin_create_user_failed", {
			email: data.email,
			error: msg.slice(0, 500),
		})
		return { ok: false, code: "failed" }
	}

	// Invite email — awaited so it completes before response (CF Workers safe).
	// Failure is logged but non-fatal: account is live, user can sign in regardless.
	try {
		await sendAdminInviteEmail({
			email: data.email,
			name: data.name,
			invitedBy: adminInfo.name?.trim() || adminInfo.email,
		})
	} catch (e) {
		logger.error("admin_invite_email_failed", {
			userId,
			email: data.email,
			error: String(e),
		})
	}

	logger.info("admin_user_created", { userId, email: data.email })
	return { ok: true, userId }
}

// ---------------------------------------------------------------------------
// listAdminUsers
// ---------------------------------------------------------------------------

export async function listAdminUsers(
	request: Request,
	data: ListAdminUsersInput,
): Promise<
	| {
			ok: true
			users: AdminUserRow[]
			total: number
			nextCursor: { createdAt: string; id: string } | null
	  }
	| { ok: false; code: "unauthorized" }
> {
	try {
		await requireAdmin(request)
	} catch {
		return { ok: false, code: "unauthorized" }
	}

	const db = getDb()

	const searchFilter = data.search
		? or(
				like(users.email, `%${data.search}%`),
				like(users.name, `%${data.search}%`),
			)
		: undefined

	const cursor = data.cursor
		? { createdAt: new Date(data.cursor.createdAt), id: data.cursor.id }
		: undefined

	const cursorFilter = cursor
		? or(
				lt(users.createdAt, cursor.createdAt),
				and(eq(users.createdAt, cursor.createdAt), lt(users.id, cursor.id)),
			)
		: undefined

	const whereClause =
		searchFilter && cursorFilter
			? and(searchFilter, cursorFilter)
			: (searchFilter ?? cursorFilter)

	// COUNT uses only the search filter (not cursor) so total reflects full result set.
	const [countRow] = await db
		.select({ count: sql<number>`COUNT(*)` })
		.from(users)
		.where(searchFilter)

	const rows = await db
		.select()
		.from(users)
		.where(whereClause)
		.orderBy(desc(users.createdAt), desc(users.id))
		.limit(data.limit + 1)

	const hasNextPage = rows.length > data.limit
	const sliced = hasNextPage ? rows.slice(0, data.limit) : rows
	const last = sliced[sliced.length - 1]
	const nextCursor =
		hasNextPage && last
			? { createdAt: last.createdAt.toISOString(), id: last.id }
			: null

	return {
		ok: true,
		users: sliced.map(toAdminUserRow),
		total: Number(countRow?.count ?? 0),
		nextCursor,
	}
}

// ---------------------------------------------------------------------------
// adjustUserCredits
// ---------------------------------------------------------------------------

export async function adjustUserCredits(
	request: Request,
	data: AdjustUserCreditsInput,
): Promise<
	| { ok: true; newCredits: number }
	| { ok: false; code: "unauthorized" | "not_found" | "below_zero" }
> {
	try {
		await requireAdmin(request)
	} catch {
		return { ok: false, code: "unauthorized" }
	}

	const db = getDb()
	const [user] = await db
		.select({ creditsRemaining: users.creditsRemaining })
		.from(users)
		.where(eq(users.id, data.userId))
		.limit(1)

	if (!user) return { ok: false, code: "not_found" }

	const newCredits = user.creditsRemaining + data.delta
	if (newCredits < 0) return { ok: false, code: "below_zero" }

	await db
		.update(users)
		.set({ creditsRemaining: newCredits, updatedAt: new Date() })
		.where(eq(users.id, data.userId))

	logger.info("[admin] credits adjusted", {
		userId: data.userId,
		delta: data.delta,
		reason: data.reason,
	})

	return { ok: true, newCredits }
}

// ---------------------------------------------------------------------------
// changeUserPlan
// ---------------------------------------------------------------------------

export async function changeUserPlan(
	request: Request,
	data: ChangePlanInput,
): Promise<{ ok: true } | { ok: false; code: "unauthorized" | "not_found" }> {
	try {
		await requireAdmin(request)
	} catch {
		return { ok: false, code: "unauthorized" }
	}

	const db = getDb()
	const result = await db
		.update(users)
		.set({ plan: data.plan, updatedAt: new Date() })
		.where(eq(users.id, data.userId))

	if (!result[0].affectedRows) return { ok: false, code: "not_found" }

	logger.info("[admin] plan changed", { userId: data.userId, plan: data.plan })

	return { ok: true }
}

// ---------------------------------------------------------------------------
// setUserRole
// ---------------------------------------------------------------------------

export async function setUserRole(
	request: Request,
	data: SetRoleInput,
): Promise<
	| { ok: true }
	| { ok: false; code: "unauthorized" | "not_found" | "cannot_self_demote" }
> {
	let adminInfo: { userId: string; email: string }
	try {
		adminInfo = await requireAdmin(request)
	} catch {
		return { ok: false, code: "unauthorized" }
	}

	// Prevent self-demotion (would lock out the admin)
	if (data.userId === adminInfo.userId && data.role !== "admin") {
		return { ok: false, code: "cannot_self_demote" }
	}

	const db = getDb()
	const result = await db
		.update(users)
		.set({ role: data.role, updatedAt: new Date() })
		.where(eq(users.id, data.userId))

	if (!result[0].affectedRows) return { ok: false, code: "not_found" }

	logger.info("[admin] role set", {
		userId: data.userId,
		role: data.role,
		byEmail: adminInfo.email,
	})

	return { ok: true }
}

// ---------------------------------------------------------------------------
// banUser
// ---------------------------------------------------------------------------

export async function banUser(
	request: Request,
	data: BanUserInput,
): Promise<
	| { ok: true }
	| { ok: false; code: "unauthorized" | "not_found" | "cannot_ban_admin" }
> {
	try {
		await requireAdmin(request)
	} catch {
		return { ok: false, code: "unauthorized" }
	}

	const db = getDb()
	const [target] = await db
		.select({ role: users.role })
		.from(users)
		.where(eq(users.id, data.userId))
		.limit(1)

	if (!target) return { ok: false, code: "not_found" }
	if (target.role === "admin") return { ok: false, code: "cannot_ban_admin" }

	await db
		.update(users)
		.set({
			banned: true,
			banReason: data.reason ?? "No reason provided",
			updatedAt: new Date(),
		})
		.where(eq(users.id, data.userId))

	return { ok: true }
}

// ---------------------------------------------------------------------------
// unbanUser
// ---------------------------------------------------------------------------

export async function unbanUser(
	request: Request,
	userId: string,
): Promise<{ ok: true } | { ok: false; code: "unauthorized" | "not_found" }> {
	try {
		await requireAdmin(request)
	} catch {
		return { ok: false, code: "unauthorized" }
	}

	const db = getDb()
	const result = await db
		.update(users)
		.set({ banned: false, banReason: null, updatedAt: new Date() })
		.where(eq(users.id, userId))

	if (!result[0].affectedRows) return { ok: false, code: "not_found" }
	return { ok: true }
}
