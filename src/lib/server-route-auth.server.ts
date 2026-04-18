import "@tanstack/react-start/server-only";

import { createMiddleware } from "@tanstack/react-start";

import { env } from "@/env";
import { isAuthorizedCron } from "@/lib/auth/verify-cron.server";
import { isAuthorizedVideoProcessorWebhook } from "@/lib/video-processor/verify-webhook.server";

/**
 * Server-route middleware: requires `Authorization: Bearer <INTERNAL_CRON_SECRET>`.
 * Used by all cron endpoints (cron-job.org or Cloudflare Cron Triggers).
 */
export const cronAuthMiddleware = createMiddleware().server(
	async ({ next, request }) => {
		if (!isAuthorizedCron(request)) {
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
