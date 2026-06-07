import { createServerFn } from "@tanstack/react-start"
import { getRequest } from "@tanstack/react-start/server"

import { auth } from "@/lib/auth"

/**
 * Server-only session read for router `beforeLoad` (avoids importing `*.server.*` from route modules).
 */
export const getRootSession = createServerFn({ method: "GET" }).handler(
	async () => {
		const request = getRequest()
		return auth.api.getSession({ headers: request.headers })
	},
)
