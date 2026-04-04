import "@tanstack/react-start/server-only";

import { enqueuePolarUsageSyncDrain } from "@/lib/worker/enqueue.server";

/**
 * After credits commit: enqueue processing on the Cloudflare Worker (queue + cron backup).
 * If the worker is unreachable, {@link enqueuePolarUsageSyncDrain} falls back to an inline drain.
 */
export function schedulePolarUsageSyncProcessing(): void {
	const run = () => {
		void enqueuePolarUsageSyncDrain();
	};
	if (typeof setImmediate !== "undefined") {
		setImmediate(run);
	} else {
		void Promise.resolve().then(run);
	}
}
