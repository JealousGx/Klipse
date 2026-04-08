import { createFileRoute } from "@tanstack/react-router";

import { triggerDueSchedules } from "@/features/scheduling/scheduling.service.server";
import { isAuthorizedWorkerOrInternalCron } from "@/lib/worker/verify-bearer.server";

/**
 * Fires content pipeline jobs for all due schedules and advances their `nextRunAt`.
 * Should be called every 15 minutes via Cloudflare Cron Triggers or an external scheduler.
 * Auth: `WORKER_SECRET` or `INTERNAL_CRON_SECRET`.
 */
export const Route = createFileRoute("/api/cron/trigger-scheduled-jobs")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				if (!isAuthorizedWorkerOrInternalCron(request)) {
					return Response.json(
						{ ok: false as const, error: "unauthorized" },
						{ status: 401 },
					);
				}

				const result = await triggerDueSchedules();
				return Response.json({ ok: true as const, ...result });
			},
		},
	},
});
