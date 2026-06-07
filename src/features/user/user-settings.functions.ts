import { createServerFn } from "@tanstack/react-start"

import {
	deleteUserAccount,
	hasPasswordAccount,
} from "@/features/user/user-settings.server"

import { withAuth } from "@/middleware/with-auth"

// ---------------------------------------------------------------------------
// hasPasswordAccountFn
// ---------------------------------------------------------------------------

export type HasPasswordAccountResult =
	| { ok: true; hasPassword: boolean }
	| { ok: false; code: "unauthorized" }

/**
 * Returns whether the authenticated user has a credential (email + password)
 * account stored — used to decide whether the settings page shows
 * "Change password" or "Set a password" UI.
 */
export const hasPasswordAccountFn = createServerFn({ method: "GET" })
	.middleware([withAuth])
	.handler(async ({ context }): Promise<HasPasswordAccountResult> => {
		return hasPasswordAccount(context.user.id)
	})

// ---------------------------------------------------------------------------
// deleteUserAccountFn
// ---------------------------------------------------------------------------

export type DeleteUserAccountResult =
	| { ok: true }
	| { ok: false; code: "unauthorized" | "error"; message?: string }

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
export const deleteUserAccountFn = createServerFn({ method: "POST" })
	.middleware([withAuth])
	.handler(async ({ context }): Promise<DeleteUserAccountResult> => {
		return deleteUserAccount(context.user.id)
	})
