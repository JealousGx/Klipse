import { desc, eq, like, or, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { users } from "@/db/schema/users";
import { requireAdmin } from "@/features/admin/admin.guard.server";

import type {
	AdjustUserCreditsInput,
	AdminUserRow,
	BanUserInput,
	ChangePlanInput,
	ListAdminUsersInput,
	SetRoleInput,
} from "@/features/admin/admin-user.functions";

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
	};
}

// ---------------------------------------------------------------------------
// listAdminUsers
// ---------------------------------------------------------------------------

export async function listAdminUsers(
	request: Request,
	data: ListAdminUsersInput,
): Promise<
	| { ok: true; users: AdminUserRow[]; total: number }
	| { ok: false; code: "unauthorized" }
> {
	try {
		await requireAdmin(request);
	} catch {
		return { ok: false, code: "unauthorized" };
	}

	const db = getDb();

	const whereClause = data.search
		? or(
				like(users.email, `%${data.search}%`),
				like(users.name, `%${data.search}%`),
			)
		: undefined;

	const [countRow] = await db
		.select({ count: sql<number>`COUNT(*)` })
		.from(users)
		.where(whereClause);

	const rows = await db
		.select()
		.from(users)
		.where(whereClause)
		.orderBy(desc(users.createdAt))
		.limit(data.limit)
		.offset(data.offset);

	return {
		ok: true,
		users: rows.map(toAdminUserRow),
		total: Number(countRow?.count ?? 0),
	};
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
		await requireAdmin(request);
	} catch {
		return { ok: false, code: "unauthorized" };
	}

	const db = getDb();
	const [user] = await db
		.select({ creditsRemaining: users.creditsRemaining })
		.from(users)
		.where(eq(users.id, data.userId))
		.limit(1);

	if (!user) return { ok: false, code: "not_found" };

	const newCredits = user.creditsRemaining + data.delta;
	if (newCredits < 0) return { ok: false, code: "below_zero" };

	await db
		.update(users)
		.set({ creditsRemaining: newCredits, updatedAt: new Date() })
		.where(eq(users.id, data.userId));

	console.info(
		`[admin] credits adjusted for ${data.userId}: ${data.delta > 0 ? "+" : ""}${data.delta} — reason: ${data.reason}`,
	);

	return { ok: true, newCredits };
}

// ---------------------------------------------------------------------------
// changeUserPlan
// ---------------------------------------------------------------------------

export async function changeUserPlan(
	request: Request,
	data: ChangePlanInput,
): Promise<{ ok: true } | { ok: false; code: "unauthorized" | "not_found" }> {
	try {
		await requireAdmin(request);
	} catch {
		return { ok: false, code: "unauthorized" };
	}

	const db = getDb();
	const result = await db
		.update(users)
		.set({ plan: data.plan, updatedAt: new Date() })
		.where(eq(users.id, data.userId));

	if (!result[0].affectedRows) return { ok: false, code: "not_found" };

	console.info(`[admin] plan changed for ${data.userId} → ${data.plan}`);

	return { ok: true };
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
	let adminInfo: { userId: string; email: string };
	try {
		adminInfo = await requireAdmin(request);
	} catch {
		return { ok: false, code: "unauthorized" };
	}

	// Prevent self-demotion (would lock out the admin)
	if (data.userId === adminInfo.userId && data.role !== "admin") {
		return { ok: false, code: "cannot_self_demote" };
	}

	const db = getDb();
	const result = await db
		.update(users)
		.set({ role: data.role, updatedAt: new Date() })
		.where(eq(users.id, data.userId));

	if (!result[0].affectedRows) return { ok: false, code: "not_found" };

	console.info(
		`[admin] role set for ${data.userId} → ${data.role} (by ${adminInfo.email})`,
	);

	return { ok: true };
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
		await requireAdmin(request);
	} catch {
		return { ok: false, code: "unauthorized" };
	}

	const db = getDb();
	const [target] = await db
		.select({ role: users.role })
		.from(users)
		.where(eq(users.id, data.userId))
		.limit(1);

	if (!target) return { ok: false, code: "not_found" };
	if (target.role === "admin") return { ok: false, code: "cannot_ban_admin" };

	await db
		.update(users)
		.set({
			banned: true,
			banReason: data.reason ?? "No reason provided",
			updatedAt: new Date(),
		})
		.where(eq(users.id, data.userId));

	return { ok: true };
}

// ---------------------------------------------------------------------------
// unbanUser
// ---------------------------------------------------------------------------

export async function unbanUser(
	request: Request,
	userId: string,
): Promise<{ ok: true } | { ok: false; code: "unauthorized" | "not_found" }> {
	try {
		await requireAdmin(request);
	} catch {
		return { ok: false, code: "unauthorized" };
	}

	const db = getDb();
	const result = await db
		.update(users)
		.set({ banned: false, banReason: null, updatedAt: new Date() })
		.where(eq(users.id, userId));

	if (!result[0].affectedRows) return { ok: false, code: "not_found" };
	return { ok: true };
}
