import "@tanstack/react-start/server-only"

import { eq } from "drizzle-orm"

import { getDb } from "@/db"
import { users } from "@/db/schema/users"
import { env } from "@/env"
import { auth } from "@/lib/auth"

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class AdminAuthError extends Error {
	constructor(message = "Admin access required") {
		super(message)
		this.name = "AdminAuthError"
	}
}

// ---------------------------------------------------------------------------
// requireAdmin
// ---------------------------------------------------------------------------

/**
 * Verifies the incoming request belongs to an authenticated admin.
 *
 * Always reads the role from the DB directly — never the cookie cache — so
 * a role downgrade takes effect immediately on the next server function call.
 *
 * Throws `AdminAuthError` if the user is not authenticated or not an admin.
 */
export async function requireAdmin(
	request: Request,
): Promise<{ userId: string; email: string; name: string }> {
	const session = await auth.api.getSession({ headers: request.headers })
	if (!session?.user) throw new AdminAuthError()

	const db = getDb()
	const [row] = await db
		.select({ role: users.role })
		.from(users)
		.where(eq(users.id, session.user.id))
		.limit(1)

	if (!row || row.role !== "admin") throw new AdminAuthError()

	return {
		userId: session.user.id,
		email: session.user.email,
		name: session.user.name,
	}
}

// ---------------------------------------------------------------------------
// maybePromoteToAdmin (bootstrapping only)
// ---------------------------------------------------------------------------

/**
 * Promotes a user to admin if their email is in the `ADMIN_EMAILS` env var.
 * This is a one-time bootstrap mechanism — after the first admin is set up
 * you can grant admin to new team members through the admin panel UI.
 *
 * Returns `true` if the user was promoted (or was already admin), `false` if
 * their email was not in the allowlist.
 */
export async function maybePromoteToAdmin(
	userId: string,
	userEmail: string,
	currentRole: string | null,
): Promise<boolean> {
	if (currentRole === "admin") return true

	const adminEmails = (env.ADMIN_EMAILS ?? "")
		.split(",")
		.map((e) => e.trim().toLowerCase())
		.filter(Boolean)

	if (!adminEmails.includes(userEmail.toLowerCase())) return false

	const db = getDb()
	await db
		.update(users)
		.set({ role: "admin", updatedAt: new Date() })
		.where(eq(users.id, userId))

	return true
}
