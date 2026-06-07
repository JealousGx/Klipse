import "@tanstack/react-start/server-only"

import { env } from "@/env"

/**
 * Validates `Authorization: Bearer <INTERNAL_CRON_SECRET>` on inbound cron requests
 * (e.g. cron-job.org). Returns `true` only when the secret matches.
 */
export function isAuthorizedCron(request: Request): boolean {
	const secret = env.INTERNAL_CRON_SECRET
	if (!secret) return false

	const auth = request.headers.get("authorization")
	if (!auth?.startsWith("Bearer ")) return false

	return auth.slice("Bearer ".length) === secret
}
