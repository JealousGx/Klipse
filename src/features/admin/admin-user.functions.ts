import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { desc, eq, like, or, sql } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db";
import { users } from "@/db/schema/users";
import { requireAdmin } from "@/features/admin/admin.guard.server";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AdminUserRow = {
	id: string;
	name: string;
	email: string;
	role: string | null;
	plan: string;
	creditsRemaining: number;
	banned: boolean | null;
	banReason: string | null;
	createdAt: Date;
};

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
// listAdminUsersFn
// ---------------------------------------------------------------------------

const listUsersInput = z.object({
	search: z.string().optional(),
	limit: z.number().int().min(1).max(200).default(100),
	offset: z.number().int().min(0).default(0),
});

export type ListAdminUsersResult =
	| { ok: true; users: AdminUserRow[]; total: number }
	| { ok: false; code: "unauthorized" };

export const listAdminUsersFn = createServerFn({ method: "POST" })
	.inputValidator((raw: unknown) => listUsersInput.parse(raw ?? {}))
	.handler(async ({ data }): Promise<ListAdminUsersResult> => {
		const request = getRequest();
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
	});

// ---------------------------------------------------------------------------
// adjustUserCreditsFn
// ---------------------------------------------------------------------------

const adjustCreditsInput = z.object({
	userId: z.string(),
	delta: z.number().int(), // positive = add, negative = subtract
	reason: z.string().min(1).max(255),
});

export type AdjustUserCreditsResult =
	| { ok: true; newCredits: number }
	| { ok: false; code: "unauthorized" | "not_found" | "below_zero" };

export const adjustUserCreditsFn = createServerFn({ method: "POST" })
	.inputValidator((raw: unknown) => adjustCreditsInput.parse(raw))
	.handler(async ({ data }): Promise<AdjustUserCreditsResult> => {
		const request = getRequest();
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
	});

// ---------------------------------------------------------------------------
// changeUserPlanFn
// ---------------------------------------------------------------------------

const changePlanInput = z.object({
	userId: z.string(),
	plan: z.enum(["free", "starter", "creator", "empire"]),
});

export type ChangeUserPlanResult =
	| { ok: true }
	| { ok: false; code: "unauthorized" | "not_found" };

export const changeUserPlanFn = createServerFn({ method: "POST" })
	.inputValidator((raw: unknown) => changePlanInput.parse(raw))
	.handler(async ({ data }): Promise<ChangeUserPlanResult> => {
		const request = getRequest();
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
	});

// ---------------------------------------------------------------------------
// setUserRoleFn
// ---------------------------------------------------------------------------

const setRoleInput = z.object({
	userId: z.string(),
	role: z.enum(["user", "admin"]),
});

export type SetUserRoleResult =
	| { ok: true }
	| { ok: false; code: "unauthorized" | "not_found" | "cannot_self_demote" };

export const setUserRoleFn = createServerFn({ method: "POST" })
	.inputValidator((raw: unknown) => setRoleInput.parse(raw))
	.handler(async ({ data }): Promise<SetUserRoleResult> => {
		const request = getRequest();
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
	});

// ---------------------------------------------------------------------------
// banUserFn / unbanUserFn
// ---------------------------------------------------------------------------

const banInput = z.object({
	userId: z.string(),
	reason: z.string().min(1).max(512).optional(),
});

export type BanUserResult =
	| { ok: true }
	| { ok: false; code: "unauthorized" | "not_found" | "cannot_ban_admin" };

export const banUserFn = createServerFn({ method: "POST" })
	.inputValidator((raw: unknown) => banInput.parse(raw))
	.handler(async ({ data }): Promise<BanUserResult> => {
		const request = getRequest();
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
	});

export type UnbanUserResult =
	| { ok: true }
	| { ok: false; code: "unauthorized" | "not_found" };

export const unbanUserFn = createServerFn({ method: "POST" })
	.inputValidator((raw: unknown) => z.object({ userId: z.string() }).parse(raw))
	.handler(async ({ data }): Promise<UnbanUserResult> => {
		const request = getRequest();
		try {
			await requireAdmin(request);
		} catch {
			return { ok: false, code: "unauthorized" };
		}

		const db = getDb();
		const result = await db
			.update(users)
			.set({ banned: false, banReason: null, updatedAt: new Date() })
			.where(eq(users.id, data.userId));

		if (!result[0].affectedRows) return { ok: false, code: "not_found" };
		return { ok: true };
	});
