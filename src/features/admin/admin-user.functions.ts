import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import {
	adjustUserCredits,
	banUser,
	changeUserPlan,
	createUserAsAdmin,
	listAdminUsers,
	setUserRole,
	unbanUser,
} from "@/features/admin/admin-user.server";

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

// ---------------------------------------------------------------------------
// listAdminUsersFn
// ---------------------------------------------------------------------------

const listUsersInput = z.object({
	search: z.string().optional(),
	limit: z.number().int().min(1).max(200).default(100),
	offset: z.number().int().min(0).default(0),
});

export type ListAdminUsersInput = z.infer<typeof listUsersInput>;

export type ListAdminUsersResult =
	| { ok: true; users: AdminUserRow[]; total: number }
	| { ok: false; code: "unauthorized" };

export const listAdminUsersFn = createServerFn({ method: "POST" })
	.inputValidator((raw: unknown) => listUsersInput.parse(raw ?? {}))
	.handler(async ({ data }): Promise<ListAdminUsersResult> => {
		return listAdminUsers(getRequest(), data);
	});

// ---------------------------------------------------------------------------
// adjustUserCreditsFn
// ---------------------------------------------------------------------------

const adjustCreditsInput = z.object({
	userId: z.string(),
	delta: z.number().int(), // positive = add, negative = subtract
	reason: z.string().min(1).max(255),
});

export type AdjustUserCreditsInput = z.infer<typeof adjustCreditsInput>;

export type AdjustUserCreditsResult =
	| { ok: true; newCredits: number }
	| { ok: false; code: "unauthorized" | "not_found" | "below_zero" };

export const adjustUserCreditsFn = createServerFn({ method: "POST" })
	.inputValidator((raw: unknown) => adjustCreditsInput.parse(raw))
	.handler(async ({ data }): Promise<AdjustUserCreditsResult> => {
		return adjustUserCredits(getRequest(), data);
	});

// ---------------------------------------------------------------------------
// changeUserPlanFn
// ---------------------------------------------------------------------------

const changePlanInput = z.object({
	userId: z.string(),
	plan: z.enum(["free", "starter", "creator", "empire"]),
});

export type ChangePlanInput = z.infer<typeof changePlanInput>;

export type ChangeUserPlanResult =
	| { ok: true }
	| { ok: false; code: "unauthorized" | "not_found" };

export const changeUserPlanFn = createServerFn({ method: "POST" })
	.inputValidator((raw: unknown) => changePlanInput.parse(raw))
	.handler(async ({ data }): Promise<ChangeUserPlanResult> => {
		return changeUserPlan(getRequest(), data);
	});

// ---------------------------------------------------------------------------
// setUserRoleFn
// ---------------------------------------------------------------------------

const setRoleInput = z.object({
	userId: z.string(),
	role: z.enum(["user", "admin"]),
});

export type SetRoleInput = z.infer<typeof setRoleInput>;

export type SetUserRoleResult =
	| { ok: true }
	| { ok: false; code: "unauthorized" | "not_found" | "cannot_self_demote" };

export const setUserRoleFn = createServerFn({ method: "POST" })
	.inputValidator((raw: unknown) => setRoleInput.parse(raw))
	.handler(async ({ data }): Promise<SetUserRoleResult> => {
		return setUserRole(getRequest(), data);
	});

// ---------------------------------------------------------------------------
// banUserFn / unbanUserFn
// ---------------------------------------------------------------------------

const banInput = z.object({
	userId: z.string(),
	reason: z.string().min(1).max(512).optional(),
});

export type BanUserInput = z.infer<typeof banInput>;

export type BanUserResult =
	| { ok: true }
	| { ok: false; code: "unauthorized" | "not_found" | "cannot_ban_admin" };

export const banUserFn = createServerFn({ method: "POST" })
	.inputValidator((raw: unknown) => banInput.parse(raw))
	.handler(async ({ data }): Promise<BanUserResult> => {
		return banUser(getRequest(), data);
	});

export type UnbanUserResult =
	| { ok: true }
	| { ok: false; code: "unauthorized" | "not_found" };

export const unbanUserFn = createServerFn({ method: "POST" })
	.inputValidator((raw: unknown) => z.object({ userId: z.string() }).parse(raw))
	.handler(async ({ data }): Promise<UnbanUserResult> => {
		return unbanUser(getRequest(), data.userId);
	});

// ---------------------------------------------------------------------------
// createUserFn
// ---------------------------------------------------------------------------

const createUserInput = z.object({
	email: z.string().trim().email().max(255),
	name: z.string().trim().min(1).max(255),
});

export type CreateUserInput = z.infer<typeof createUserInput>;

export type CreateUserResult =
	| { ok: true; userId: string }
	| { ok: false; code: "unauthorized" | "email_taken" | "failed" };

export const createUserFn = createServerFn({ method: "POST" })
	.inputValidator((raw: unknown) => createUserInput.parse(raw))
	.handler(async ({ data }): Promise<CreateUserResult> => {
		return createUserAsAdmin(getRequest(), data);
	});
