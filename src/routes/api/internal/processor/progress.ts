import { createFileRoute } from "@tanstack/react-router";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db";
import { videoJobs } from "@/db/schema/video-jobs";
import { PIPELINE_STAGE } from "@/features/video/pipeline/pipeline-kind";
import { videoProcessorAuthMiddleware } from "@/lib/server-route-auth.server";

const bodySchema = z.object({
	jobId: z.string().trim().min(1).max(64),
	stage: z.enum(["script", "prepare", "assemble"]),
	progress: z.number().int().min(0).max(100),
});

const STAGE_MAP: Record<string, string> = {
	script: PIPELINE_STAGE.SCRIPT,
	prepare: PIPELINE_STAGE.PREPARE,
	assemble: PIPELINE_STAGE.ASSEMBLE,
};

/** Processor → app: update job progress during pipeline execution. */
export const Route = createFileRoute("/api/internal/processor/progress")({
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

				const { jobId, stage, progress } = parsed.data;
				const currentStage = STAGE_MAP[stage] ?? stage;

				// Accept progress from both "dispatched" and "processing" to avoid
				// dropping callbacks that arrive before the app flips dispatched → processing.
				await getDb()
					.update(videoJobs)
					.set({ currentStage, progress, updatedAt: new Date() })
					.where(
						and(
							eq(videoJobs.id, jobId),
							inArray(videoJobs.status, ["dispatched", "processing"]),
						),
					);

				return Response.json({ ok: true as const });
			},
		},
	},
});
