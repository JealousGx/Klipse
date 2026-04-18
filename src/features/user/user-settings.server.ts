import { and, eq, isNotNull } from "drizzle-orm";

import { getDb } from "@/db";
import { accounts } from "@/db/schema/accounts";
import { users } from "@/db/schema/users";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { deleteUserR2Data } from "@/lib/storage/r2.server";

// ---------------------------------------------------------------------------
// hasPasswordAccount
// ---------------------------------------------------------------------------

export async function hasPasswordAccount(
	request: Request,
): Promise<
	{ ok: true; hasPassword: boolean } | { ok: false; code: "unauthorized" }
> {
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
}

// ---------------------------------------------------------------------------
// deleteUserAccount
// ---------------------------------------------------------------------------

export async function deleteUserAccount(
	request: Request,
): Promise<
	{ ok: true } | { ok: false; code: "unauthorized" | "error"; message?: string }
> {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) {
		return { ok: false, code: "unauthorized" };
	}

	const userId = session.user.id;

	// Step 1 — purge R2 (best-effort; don't fail account deletion if R2 is down)
	try {
		const { deleted } = await deleteUserR2Data(userId);
		logger.info("[account-deletion] R2 purged objects for user", {
			userId,
			deleted,
		});
	} catch (e) {
		logger.error(
			"[account-deletion] R2 purge failed — proceeding with DB deletion",
			{
				userId,
				error: e instanceof Error ? e.message : String(e),
			},
		);
	}

	// Step 2 — delete the user row (cascades everything else)
	try {
		const db = getDb();
		await db.delete(users).where(eq(users.id, userId));
	} catch (e) {
		logger.error("[account-deletion] DB deletion failed for user", {
			userId,
			error: e instanceof Error ? e.message : String(e),
		});
		return {
			ok: false,
			code: "error",
			message: "Account deletion failed. Please try again or contact support.",
		};
	}

	return { ok: true };
}
