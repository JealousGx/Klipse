import { createServerFn } from "@tanstack/react-start"

import { withAuth } from "@/middleware/with-auth"

import { getAnalyticsSummaryForUser } from "./analytics.service.server"

export type GetAnalyticsSummaryResult =
	| {
			ok: true
			summary: Awaited<ReturnType<typeof getAnalyticsSummaryForUser>>
	  }
	| { ok: false; code: "unauthorized" }

export const getAnalyticsSummaryFn = createServerFn({
	method: "GET",
})
	.middleware([withAuth])
	.handler(async ({ context }): Promise<GetAnalyticsSummaryResult> => {
		const summary = await getAnalyticsSummaryForUser(context.user.id)
		return { ok: true, summary }
	})
