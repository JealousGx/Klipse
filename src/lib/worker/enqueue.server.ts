import "@tanstack/react-start/server-only";

import { QUEUE_MESSAGE_KIND } from "@klipse/worker-contracts";

import { env } from "@/env";
import { processPolarUsageSyncBatch } from "@/features/billing/polar-usage-sync-process.server";

/**
 * Ask the Cloudflare Worker to enqueue Polar outbox processing. On failure (worker down),
 * falls back to an in-process drain so local dev stays usable without `wrangler dev`.
 */
export async function enqueuePolarUsageSyncDrain(): Promise<void> {
	const base = env.WORKER_API_URL.replace(/\/$/, "");
	const url = `${base}/enqueue`;

	try {
		const res = await fetch(url, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${env.WORKER_SECRET}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				kind: QUEUE_MESSAGE_KIND.polarUsageSyncDrain,
			}),
			signal: AbortSignal.timeout(8000),
		});

		if (!res.ok) {
			throw new Error(`enqueue ${res.status}: ${await res.text()}`);
		}
	} catch (err) {
		console.warn(
			"[enqueue] worker unreachable, draining polar outbox inline",
			err,
		);
		void processPolarUsageSyncBatch({ limit: 25 }).catch((e) => {
			console.error("[polar_usage_sync] inline fallback failed", e);
		});
	}
}
