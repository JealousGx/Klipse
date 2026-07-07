import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { applyVideoProcessorWebhook } from "@/features/video/pipeline/video-assembly-processor-webhook.server"
import { videoProcessorAuthMiddleware } from "@/middleware/server-route-auth"

const bodySchema = z.object({
	jobId: z.string().trim().min(1).max(64),
	userId: z.string().trim().min(1).max(64),
	status: z.enum(["completed", "failed"]),
	error: z.string().max(4000).optional(),
	scriptText: z.string().max(50000).optional(),
	// script-generation.server.ts's prompt targets "60-100 chars" as guidance, not a
	// hard ceiling — a small margin above 100 avoids rejecting a good generation over a
	// minor LLM overshoot.
	title: z.string().max(120).optional(),
	description: z.string().max(2000).optional(),
	// script-generation.server.ts's prompt instructs the LLM to produce a *minimum* of
	// 100 tags — this cap must stay comfortably above that floor or every successful
	// generation that follows its own instructions gets rejected here.
	tags: z.array(z.string().max(50)).max(150).optional(),
	/** Actual encoded video duration in whole seconds, probed by the processor. */
	durationSec: z.number().int().positive().optional(),
})

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
				const raw: unknown = await request.json().catch(() => null)
				const parsed = bodySchema.safeParse(raw)
				if (!parsed.success) {
					return Response.json(
						{ ok: false as const, error: "invalid_body" },
						{ status: 400 },
					)
				}

				const result = await applyVideoProcessorWebhook(parsed.data)
				if (!result.ok) {
					const status =
						result.code === "job_not_found"
							? 404
							: result.code === "user_mismatch"
								? 403
								: 409
					return Response.json(
						{ ok: false as const, code: result.code },
						{ status },
					)
				}

				return Response.json({
					ok: true as const,
					replayed: result.replayed,
				})
			},
		},
	},
})
