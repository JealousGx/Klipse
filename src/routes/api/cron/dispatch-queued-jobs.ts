import { createFileRoute } from "@tanstack/react-router"

import { dispatchQueuedJobs } from "@/features/video/pipeline/dispatch-queued-jobs.server"
import { cronAuthMiddleware } from "@/middleware/server-route-auth"

/**
 * Picks up at most one `queued` video job per tick and dispatches it to the external
 * processor. Also re-dispatches stuck `dispatched` jobs (processor handoff timed out) and
 * fails jobs stuck in `processing` (stall timeout, GPU execution cancelled). Actual
 * dispatch rate is throttled to 1 concurrent job / 5 min minimum gap regardless of cron
 * cadence — see `dispatchQueuedJobs` for the guardrails (cost control: each dispatch
 * spins up a GPU Cloud Run Job execution).
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
				const result = await dispatchQueuedJobs()
				return Response.json({ ok: true as const, ...result })
			},
		},
	},
})
