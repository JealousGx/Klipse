import type {
	ExecutionContext,
	MessageBatch,
} from "@cloudflare/workers-types";
import { isQueueMessage } from "@klipse/worker-contracts";

import { dispatchQueueMessage } from "./dispatch";
import type { Env } from "./env";

export default {
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
		const url = new URL(request.url);

		if (request.method === "GET" && url.pathname === "/health") {
			return new Response("ok", { status: 200 });
		}

		if (request.method === "POST" && url.pathname === "/enqueue") {
			const auth = request.headers.get("Authorization");
			if (auth !== `Bearer ${env.WORKER_SECRET}`) {
				return new Response("unauthorized", { status: 401 });
			}

			const raw: unknown = await request.json().catch(() => null);
			if (!isQueueMessage(raw)) {
				return new Response("invalid body", { status: 400 });
			}

			await env.klipse_jobs.send(raw);
			return Response.json({ ok: true as const });
		}

		return new Response("not found", { status: 404 });
	},

	async queue(
		batch: MessageBatch<unknown>,
		env: Env,
		_ctx: ExecutionContext,
	): Promise<void> {
		for (const msg of batch.messages) {
			try {
				if (!isQueueMessage(msg.body)) {
					console.error("[queue] drop invalid body", msg.body);
					msg.ack();
					continue;
				}
				await dispatchQueueMessage(msg.body, env);
				msg.ack();
			} catch (err) {
				console.error("[queue] message failed", err);
				msg.retry({ delaySeconds: 20 });
			}
		}
	},
};
