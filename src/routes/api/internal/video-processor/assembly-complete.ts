import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { env } from "@/env";
import { applyVideoProcessorWebhook } from "@/features/video/pipeline/video-assembly-processor-webhook.server";
import { isAuthorizedVideoProcessorWebhook } from "@/lib/video-processor/verify-webhook.server";

const bodySchema = z.object({
	jobId: z.string().trim().min(1).max(64),
	userId: z.string().trim().min(1).max(64),
	status: z.enum(["completed", "failed"]),
	error: z.string().max(4000).optional(),
	scriptText: z.string().max(50000).optional(),
	title: z.string().max(100).optional(),
	description: z.string().max(2000).optional(),
	tags: z.array(z.string().max(50)).max(10).optional(),
});

/**
 * External encoder host → app: finalize `video_jobs` + public URL (no file bytes).
 */
export const Route = createFileRoute(
	"/api/internal/video-processor/assembly-complete",
)({
	server: {
		handlers: {
			POST: async ({ request }) => {
				if (!env.VIDEO_PROCESSOR_WEBHOOK_SECRET) {
					return Response.json(
						{ ok: false as const, error: "webhook_not_configured" },
						{ status: 503 },
					);
				}
				if (!isAuthorizedVideoProcessorWebhook(request)) {
					return Response.json(
						{ ok: false as const, error: "unauthorized" },
						{ status: 401 },
					);
				}

				const raw: unknown = await request.json().catch(() => null);
				const parsed = bodySchema.safeParse(raw);
				if (!parsed.success) {
					return Response.json(
						{ ok: false as const, error: "invalid_body" },
						{ status: 400 },
					);
				}

				const result = await applyVideoProcessorWebhook(parsed.data);
				if (!result.ok) {
					const status =
						result.code === "job_not_found"
							? 404
							: result.code === "user_mismatch"
								? 403
								: 409;
					return Response.json(
						{ ok: false as const, code: result.code },
						{ status },
					);
				}

				return Response.json({
					ok: true as const,
					replayed: result.replayed,
				});
			},
		},
	},
});
