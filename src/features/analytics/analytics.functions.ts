import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { auth } from "@/lib/auth";

import { getAnalyticsSummaryForUser } from "./analytics.service.server";

export type GetAnalyticsSummaryResult =
	| {
			ok: true;
			summary: Awaited<ReturnType<typeof getAnalyticsSummaryForUser>>;
	  }
	| { ok: false; code: "unauthorized" };

export const getAnalyticsSummaryFn = createServerFn({
	method: "GET",
}).handler(async (): Promise<GetAnalyticsSummaryResult> => {
	const request = getRequest();
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) {
		return { ok: false, code: "unauthorized" };
	}
	const summary = await getAnalyticsSummaryForUser(session.user.id);
	return { ok: true, summary };
});
