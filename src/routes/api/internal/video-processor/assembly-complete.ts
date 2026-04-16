import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { applyVideoProcessorWebhook } from "@/features/video/pipeline/video-assembly-processor-webhook.server";
import { videoProcessorAuthMiddleware } from "@/lib/server-route-auth.server";

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
		middleware: [videoProcessorAuthMiddleware],
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
