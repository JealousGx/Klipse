import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { processPolarUsageSyncBatch } from "@/features/billing/polar-usage-sync-process.server";
import { isAuthorizedWorkerOrInternalCron } from "@/lib/worker/verify-bearer.server";

const bodySchema = z.object({
	limit: z.number().int().min(1).max(200).optional(),
});

/**
 * Worker → main app: DB + Polar metering runs only here. Protected by `WORKER_SECRET`
 * (and optional `INTERNAL_CRON_SECRET` for non-Worker cron).
 */
export const Route = createFileRoute(
	"/api/internal/worker/polar-usage-sync/drain",
)({
	server: {
		handlers: {
			POST: async ({ request }) => {
				if (!isAuthorizedWorkerOrInternalCron(request)) {
					return Response.json(
						{ ok: false as const, error: "unauthorized" },
						{ status: 401 },
					);
				}

				let limit = 25;
				const ct = request.headers.get("content-type");
				if (ct?.includes("application/json")) {
					const raw = await request.json().catch(() => ({}));
					const parsed = bodySchema.safeParse(raw);
					if (parsed.success && parsed.data.limit != null) {
						limit = parsed.data.limit;
					}
				}

				const result = await processPolarUsageSyncBatch({ limit });
				return Response.json({ ok: true as const, ...result });
			},
		},
	},
});
