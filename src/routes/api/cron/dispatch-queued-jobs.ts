import { createFileRoute } from "@tanstack/react-router";

import { dispatchQueuedJobs } from "@/features/video/pipeline/dispatch-queued-jobs.server";
import { cronAuthMiddleware } from "@/lib/server-route-auth.server";

/**
 * Picks up all `queued` video jobs and dispatches them to the external processor.
 * Also re-dispatches stuck `dispatched` jobs (processor handoff timed out).
 *
 * Call every 1 minute via cron-job.org:
 *   POST https://klipse.app/api/cron/dispatch-queued-jobs
 *   Authorization: Bearer <INTERNAL_CRON_SECRET>
 */
export const Route = createFileRoute("/api/cron/dispatch-queued-jobs")({
	server: {
		middleware: [cronAuthMiddleware],
		handlers: {
			POST: async () => {
				const result = await dispatchQueuedJobs();
				return Response.json({ ok: true as const, ...result });
			},
		},
	},
});
