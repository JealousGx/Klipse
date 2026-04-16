import "@tanstack/react-start/server-only";

import { createMiddleware } from "@tanstack/react-start";

import { env } from "@/env";
import { isAuthorizedVideoProcessorWebhook } from "@/lib/video-processor/verify-webhook.server";
import { isAuthorizedWorkerOrInternalCron } from "@/lib/worker/verify-bearer.server";

/**
 * Server-route middleware: requires a valid worker/cron bearer token.
 * Returns 401 if the `Authorization: Bearer` header doesn't match
 * `WORKER_SECRET` or `INTERNAL_CRON_SECRET`.
 */
export const workerAuthMiddleware = createMiddleware().server(
	async ({ next, request }) => {
		if (!isAuthorizedWorkerOrInternalCron(request)) {
			return Response.json(
				{ ok: false as const, error: "unauthorized" },
				{ status: 401 },
			);
		}
		return next();
	},
);

/**
 * Server-route middleware: requires a valid video-processor webhook secret.
 * Returns 503 if `VIDEO_PROCESSOR_WEBHOOK_SECRET` is not configured,
 * 401 if the bearer token doesn't match.
 */
export const videoProcessorAuthMiddleware = createMiddleware().server(
	async ({ next, request }) => {
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
		return next();
	},
);
