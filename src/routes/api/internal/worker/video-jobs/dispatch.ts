import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { dispatchPipelineForJob } from "@/features/video/pipeline/process-video-job-dispatch.server";
import { workerAuthMiddleware } from "@/lib/server-route-auth.server";

const bodySchema = z.object({
	jobId: z.string().trim().min(1).max(64),
	userId: z.string().trim().min(1).max(64),
	pipelineKind: z.string().trim().min(1).max(32),
});

/**
 * Worker → main app: run pipeline steps that need DB (and future R2 / providers).
 */
export const Route = createFileRoute(
	"/api/internal/worker/video-jobs/dispatch",
)({
	server: {
		middleware: [workerAuthMiddleware],
		handlers: {
			POST: async ({ request }) => {
				const raw: unknown = await request.json().catch(() => null);
				const parsed = bodySchema.safeParse(raw);
				if (!parsed.success) {
					return Response.json(
						{ ok: false as const, error: "invalid_body" },
						{ status: 400 },
					);
				}

				try {
					await dispatchPipelineForJob(parsed.data);
					return Response.json({ ok: true as const });
				} catch (e) {
					const message = e instanceof Error ? e.message : "dispatch_failed";
					console.error("[video-jobs/dispatch]", e);
					return Response.json(
						{ ok: false as const, error: message },
						{ status: 422 },
					);
				}
			},
		},
	},
});
