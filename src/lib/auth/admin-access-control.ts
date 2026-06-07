/**
 * Scalable RBAC for the Klipse admin panel.
 *
 * Built on top of the Better Auth admin plugin's `createAccessControl`.
 * To add a new role (e.g. "support"), define it here and register it in
 * both `src/lib/auth/index.ts` (server) and `src/lib/auth/client.ts` (client).
 *
 * Current roles:
 *   admin   — full super-admin access (you, the operator)
 *   user    — regular user, no admin permissions
 *
 * Adding a role later:
 *   1. Add it to `adminRoles` below with the permissions it needs.
 *   2. Register it in auth/index.ts and client.ts.
 *   3. Assign the role to the team member via the Users admin page.
 */

import { createAccessControl } from "better-auth/plugins/access"
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access"

// ── Resource + action definitions ────────────────────────────────────────────

const statement = {
	// Preserve all built-in user/session management resources
	...defaultStatements,
	// Klipse-specific admin resources
	apiKeys: ["create", "read", "disable", "delete", "resetCooldown"] as const,
	adminJobs: ["read", "cancel"] as const,
	systemStats: ["read"] as const,
	billing: ["read", "adjustCredits", "changePlan"] as const,
} as const

export const ac = createAccessControl(statement)

// ── Role definitions ──────────────────────────────────────────────────────────

/**
 * Full super-admin: access to everything — user management, API keys,
 * jobs, system stats, and billing overrides.
 */
export const adminRole = ac.newRole({
	// Inherit all built-in admin capabilities (ban, impersonate, set-role, etc.)
	...adminAc.statements,
	// Klipse-specific
	apiKeys: ["create", "read", "disable", "delete", "resetCooldown"],
	adminJobs: ["read", "cancel"],
	systemStats: ["read"],
	billing: ["read", "adjustCredits", "changePlan"],
})

/**
 * Regular user: no admin permissions.
 * (Explicitly defined so we can register it with the AC system.)
 */
export const userRole = ac.newRole({
	apiKeys: [],
	adminJobs: [],
	systemStats: [],
	billing: [],
})

// Export the roles map for registration in auth config
export const adminRoles = {
	admin: adminRole,
	user: userRole,
} as const

export type AdminRole = keyof typeof adminRoles
