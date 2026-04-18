import { createFileRoute } from "@tanstack/react-router";

import { purgeExpiredAssets } from "@/features/video/pipeline/purge-expiring-assets-process.server";
import { cronAuthMiddleware } from "@/lib/server-route-auth.server";

/**
 * Deletes R2 objects past TTL and removes `expiring_assets` rows.
 * Auth: `INTERNAL_CRON_SECRET` bearer token.
 */
export const Route = createFileRoute("/api/cron/purge-expiring-assets")({
	server: {
		middleware: [cronAuthMiddleware],
		handlers: {
			POST: async () => {
				const result = await purgeExpiredAssets();
				return Response.json({ ok: true as const, ...result });
			},
		},
	},
});
