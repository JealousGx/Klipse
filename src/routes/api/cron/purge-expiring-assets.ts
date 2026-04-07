import { createFileRoute } from "@tanstack/react-router";

import { purgeExpiredAssets } from "@/features/video/pipeline/purge-expiring-assets-process.server";
import { isAuthorizedWorkerOrInternalCron } from "@/lib/worker/verify-bearer.server";

/**
 * Deletes R2 objects past TTL and removes `expiring_assets` rows.
 * Auth: `WORKER_SECRET` or `INTERNAL_CRON_SECRET`.
 */
export const Route = createFileRoute("/api/cron/purge-expiring-assets")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				if (!isAuthorizedWorkerOrInternalCron(request)) {
					return Response.json(
						{ ok: false as const, error: "unauthorized" },
						{ status: 401 },
					);
				}

				const result = await purgeExpiredAssets();
				return Response.json({ ok: true as const, ...result });
			},
		},
	},
});
