import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { auth } from "@/lib/auth";

/**
 * Dashboard layout: Better Auth session (user includes `additionalFields` from DB:
 * plan, credits, etc.). Same source as `auth.api.getSession` elsewhere.
 */
export const getDashboardLayoutData = createServerFn({ method: "GET" }).handler(
	async () => {
		const request = getRequest();
		const session = await auth.api.getSession({ headers: request.headers });
		return { session };
	},
);
