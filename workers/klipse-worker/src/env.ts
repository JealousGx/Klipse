import type { Queue } from "@cloudflare/workers-types";
import type { QueueMessage } from "@klipse/worker-contracts";

export interface Env {
	JOBS_QUEUE: Queue<QueueMessage>;
	MAIN_APP_URL: string;
	WORKER_SECRET: string;
}
