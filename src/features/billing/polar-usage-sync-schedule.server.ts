import "@tanstack/react-start/server-only";

import { enqueuePolarUsageSyncDrain } from "@/lib/worker/enqueue.server";

/**
 * After credits commit: enqueue processing on the Cloudflare Worker (queue + cron backup).
 * If enqueue fails, {@link enqueuePolarUsageSyncDrain} runs the same batch drain in-process.
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
