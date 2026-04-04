import { createFileRoute } from "@tanstack/react-router";

import { processPolarUsageSyncBatch } from "@/features/billing/polar-usage-sync-process.server";
import { isAuthorizedWorkerOrInternalCron } from "@/lib/worker/verify-bearer.server";

/**
 * Optional external cron (e.g. hosted scheduler) hitting the app directly.
 * Prefer routing cron through the Worker in production. Auth: `WORKER_SECRET` or `INTERNAL_CRON_SECRET`.
 */
export const Route = createFileRoute("/api/cron/polar-usage-sync")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				if (!isAuthorizedWorkerOrInternalCron(request)) {
					return Response.json(
						{ ok: false as const, error: "unauthorized" },
						{ status: 401 },
					);
				}

				const result = await processPolarUsageSyncBatch({ limit: 50 });
				return Response.json({ ok: true as const, ...result });
			},
		},
	},
});
