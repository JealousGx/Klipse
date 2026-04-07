import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { runYoutubePublishForJob } from "@/features/publishing/youtube/run-youtube-publish-for-job.server";
import { isAuthorizedWorkerOrInternalCron } from "@/lib/worker/verify-bearer.server";

const bodySchema = z.object({
	jobId: z.string().trim().min(1).max(64),
	userId: z.string().trim().min(1).max(64),
});

/**
 * Worker → main app: upload completed MP4 to YouTube (FEATURE_DOC §2.12 / §2.15).
 */
export const Route = createFileRoute("/api/internal/worker/youtube-publish")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				if (!isAuthorizedWorkerOrInternalCron(request)) {
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

				try {
					const result = await runYoutubePublishForJob(parsed.data);
					return Response.json({ ok: true as const, result });
				} catch (e) {
					const message = e instanceof Error ? e.message : "publish_failed";
					console.error("[youtube-publish]", e);
					return Response.json(
						{ ok: false as const, error: message },
						{ status: 422 },
					);
				}
			},
		},
	},
});
