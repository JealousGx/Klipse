import type { ExecutionContext, MessageBatch } from "@cloudflare/workers-types";
import { isQueueMessage } from "@klipse/worker-contracts";
import * as Sentry from "@sentry/cloudflare";

import { dispatchQueueMessage } from "./dispatch";
import type { Env } from "./env";
import { createLogger } from "./logger";

const worker = {
	async fetch(
		request: {
			url: string;
			method: string;
			headers: Headers;
			json(): Promise<unknown>;
		},
		env: Env,
		_ctx: ExecutionContext,
	): Promise<Response> {
		const log = createLogger(env.ENVIRONMENT);
		const url = new URL(request.url);

		if (request.method === "GET" && url.pathname === "/health") {
			return new Response("ok", { status: 200 });
		}

		if (request.method === "POST" && url.pathname === "/enqueue") {
			const auth = request.headers.get("Authorization");
			if (auth !== `Bearer ${env.WORKER_SECRET}`) {
				log.warn("Enqueue rejected: unauthorized", {
					path: url.pathname,
					method: request.method,
				});
				return new Response("unauthorized", { status: 401 });
			}

			const raw: unknown = await request.json().catch(() => null);
			if (typeof raw !== "object" || raw === null) {
				log.warn("Enqueue rejected: invalid body");
				return new Response("invalid body", { status: 400 });
			}

			// `isPriority` is a routing hint from the main app — strip before queue storage.
			const { isPriority, ...message } = raw as Record<string, unknown>;
			if (!isQueueMessage(message)) {
				log.warn("Enqueue rejected: invalid queue message shape");
				return new Response("invalid body", { status: 400 });
			}

			const queue = isPriority
				? env.klipse_jobs_priority
				: env.klipse_jobs_free;
			await queue.send(message);
			log.info("Message enqueued", {
				queue: isPriority ? "priority" : "free",
				kind: (message as { kind?: string }).kind,
			});
			return Response.json({ ok: true as const });
		}

		return new Response("not found", { status: 404 });
	},

	async queue(
		batch: MessageBatch<unknown>,
		env: Env,
		_ctx: ExecutionContext,
	): Promise<void> {
		const log = createLogger(env.ENVIRONMENT);
		log.info("Processing queue batch", {
			queue: batch.queue,
			count: batch.messages.length,
		});

		for (const msg of batch.messages) {
			try {
				if (!isQueueMessage(msg.body)) {
					log.error("Dropping invalid queue message", {
						queue: batch.queue,
						body: JSON.stringify(msg.body).slice(0, 200),
					});
					msg.ack();
					continue;
				}
				await dispatchQueueMessage(msg.body, env);
				msg.ack();
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				log.error("Queue message failed — retrying", {
					queue: batch.queue,
					error: message,
					jobId: (msg.body as Record<string, unknown>)?.jobId as
						| string
						| undefined,
				});
				// Free-tier queue backs off longer to yield capacity to priority queue.
				msg.retry({
					delaySeconds: batch.queue === "klipse-jobs-free" ? 30 : 20,
				});
			}
		}
	},
};

export default Sentry.withSentry(
	(env: Env) => ({
		dsn: env.SENTRY_DSN,
		environment: env.ENVIRONMENT ?? "unknown",
		tracesSampleRate: 0.1,
		sendDefaultPii: false,
		enableLogs: true,
	}),
	worker,
);
