import { createFileRoute } from "@tanstack/react-router";

import { purgeExpiredStoredFiles } from "@/features/video/pipeline/purge-stored-files-process.server";
import { isAuthorizedWorkerOrInternalCron } from "@/lib/worker/verify-bearer.server";

/**
 * Deletes R2 objects past TTL and removes `stored_files` rows (FEATURE_DOC §2.7–2.8).
 * Auth: `WORKER_SECRET` or `INTERNAL_CRON_SECRET`.
 */
export const Route = createFileRoute("/api/cron/purge-stored-files")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				if (!isAuthorizedWorkerOrInternalCron(request)) {
					return Response.json(
						{ ok: false as const, error: "unauthorized" },
						{ status: 401 },
					);
				}

				const result = await purgeExpiredStoredFiles();
				return Response.json({ ok: true as const, ...result });
			},
		},
	},
});
