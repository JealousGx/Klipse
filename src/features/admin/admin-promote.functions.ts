import { createServerFn } from "@tanstack/react-start";

import { maybePromoteToAdmin } from "@/features/admin/admin.guard.server";

/**
 * Server function wrapper around `maybePromoteToAdmin` so that route modules
 * (which are bundled for the client) can call this without directly importing
 * the `.server.ts` guard file.
 */
export const checkAndPromoteAdminFn = createServerFn({ method: "GET" })
	.inputValidator(
		(data: { userId: string; email: string; currentRole: string | null }) =>
			data,
	)
	.handler(async ({ data }) => {
		return maybePromoteToAdmin(data.userId, data.email, data.currentRole);
	});
