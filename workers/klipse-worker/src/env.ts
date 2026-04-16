import type { Queue } from "@cloudflare/workers-types";
import type { QueueMessage } from "@klipse/worker-contracts";

export interface Env {
	/** Paid users (starter / creator / empire) — higher throughput, faster retry. */
	klipse_jobs_priority: Queue<QueueMessage>;
	/** Free users — lower throughput, slower retry. */
	klipse_jobs_free: Queue<QueueMessage>;
	MAIN_APP_URL: string;
	WORKER_SECRET: string;
	/** Deployment environment label — set in wrangler.toml vars or .dev.vars. */
	ENVIRONMENT?: string;
	/** Sentry DSN — optional. No-op when absent. Set in wrangler.toml vars or .dev.vars. */
	SENTRY_DSN?: string;
}
