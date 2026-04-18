import { createFileRoute } from "@tanstack/react-router";

import { triggerDueSchedules } from "@/features/scheduling/scheduling.service.server";
import { cronAuthMiddleware } from "@/lib/server-route-auth.server";

/**
 * Fires content pipeline jobs for all due schedules and advances their `nextRunAt`.
 * Should be called every 15 minutes via Cloudflare Cron Triggers or an external scheduler.
 * Auth: `WORKER_SECRET` or `INTERNAL_CRON_SECRET`.
 */
export const Route = createFileRoute("/api/cron/trigger-scheduled-jobs")({
	server: {
		middleware: [cronAuthMiddleware],
		handlers: {
			POST: async () => {
				const result = await triggerDueSchedules();
				return Response.json({ ok: true as const, ...result });
			},
		},
	},
});
