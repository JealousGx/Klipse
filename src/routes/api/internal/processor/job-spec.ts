import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { buildProcessorJobSpec } from "@/features/video/pipeline/build-processor-job-spec.server"
import { videoProcessorAuthMiddleware } from "@/middleware/server-route-auth"

const querySchema = z.object({
	jobId: z.string().trim().min(1).max(64),
})

/**
 * Processor (Cloud Run Job) → app: fetch the full ProcessorJobSpec for a job it was
 * triggered with. The Job execution only receives `jobId` as a container override (Cloud
 * Run Admin API overrides aren't a place to carry provider-key secrets or long prompt
 * text) — it pulls the rest here, same auth as the progress/complete callbacks.
 */
export const Route = createFileRoute("/api/internal/processor/job-spec")({
	server: {
		middleware: [videoProcessorAuthMiddleware],
		handlers: {
			GET: async ({ request }) => {
				const url = new URL(request.url)
				const parsed = querySchema.safeParse({
					jobId: url.searchParams.get("jobId") ?? "",
				})
				if (!parsed.success) {
					return Response.json(
						{ ok: false as const, error: "invalid_query" },
						{ status: 400 },
					)
				}

				try {
					const spec = await buildProcessorJobSpec(parsed.data.jobId)
					return Response.json({ ok: true as const, spec })
				} catch (e) {
					const message = e instanceof Error ? e.message : "spec_build_failed"
					const notFound =
						message === "video_job_not_found" ||
						message === "video_job_missing_idea"
					return Response.json(
						{ ok: false as const, error: message },
						{ status: notFound ? 404 : 500 },
					)
				}
			},
		},
	},
})
