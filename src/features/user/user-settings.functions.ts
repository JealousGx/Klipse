import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { and, eq, isNotNull } from "drizzle-orm";

import { getDb } from "@/db";
import { accounts } from "@/db/schema/accounts";
import { users } from "@/db/schema/users";
import { auth } from "@/lib/auth";
import { deleteUserR2Data } from "@/lib/storage/r2.server";

// ---------------------------------------------------------------------------
// hasPasswordAccountFn
// ---------------------------------------------------------------------------

export type HasPasswordAccountResult =
	| { ok: true; hasPassword: boolean }
	| { ok: false; code: "unauthorized" };

/**
 * Returns whether the authenticated user has a credential (email + password)
 * account stored — used to decide whether the settings page shows
 * "Change password" or "Set a password" UI.
 */
export const hasPasswordAccountFn = createServerFn({ method: "GET" }).handler(
	async (): Promise<HasPasswordAccountResult> => {
		const request = getRequest();
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) {
			return { ok: false, code: "unauthorized" };
		}

		const db = getDb();
		const [row] = await db
			.select({ id: accounts.id })
			.from(accounts)
			.where(
				and(
					eq(accounts.userId, session.user.id),
					eq(accounts.providerId, "credential"),
					isNotNull(accounts.password),
				),
			)
			.limit(1);

		return { ok: true, hasPassword: Boolean(row) };
	},
);

// ---------------------------------------------------------------------------
// deleteUserAccountFn
// ---------------------------------------------------------------------------

export type DeleteUserAccountResult =
	| { ok: true }
	| { ok: false; code: "unauthorized" | "error"; message?: string };

/**
 * Permanently deletes the authenticated user's account.
 *
 * Order of operations:
 *  1. Delete all R2 assets under `{env}/u/{userId}/` (best-effort; logged but
 *     not fatal if R2 is unavailable — the DB row is the source of truth for
 *     billing and auth, so we always proceed to step 2).
 *  2. Delete the `users` row.  All related rows cascade automatically:
 *     accounts, sessions, channels, schedules, video_jobs, expiring_assets,
 *     credit_transactions, usage_idempotency.
 *
 * Does NOT touch Polar — subscription management lives outside our DB.
 */
export const deleteUserAccountFn = createServerFn({ method: "POST" }).handler(
	async (): Promise<DeleteUserAccountResult> => {
		const request = getRequest();
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) {
			return { ok: false, code: "unauthorized" };
		}

		const userId = session.user.id;

		// Step 1 — purge R2 (best-effort; don't fail account deletion if R2 is down)
		try {
			const { deleted } = await deleteUserR2Data(userId);
			console.info(
				`[account-deletion] R2 purged ${deleted} object(s) for user ${userId}`,
			);
		} catch (e) {
			console.error(
				`[account-deletion] R2 purge failed for user ${userId} — proceeding with DB deletion`,
				e,
			);
		}

		// Step 2 — delete the user row (cascades everything else)
		try {
			const db = getDb();
			await db.delete(users).where(eq(users.id, userId));
		} catch (e) {
			console.error(
				`[account-deletion] DB deletion failed for user ${userId}`,
				e,
			);
			return {
				ok: false,
				code: "error",
				message:
					"Account deletion failed. Please try again or contact support.",
			};
		}

		return { ok: true };
	},
);
