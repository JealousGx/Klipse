import "@tanstack/react-start/server-only";

import {
	QUEUE_MESSAGE_KIND,
	type VideoJobDispatchMessage,
} from "@klipse/worker-contracts";

import { env } from "@/env";
import { processPolarUsageSyncBatch } from "@/features/billing/polar-usage-sync-process.server";
import { markVideoJobFailed } from "@/features/video/pipeline/process-stub-pipeline.server";
import { dispatchPipelineForJob } from "@/features/video/pipeline/process-video-job-dispatch.server";

/** Thrown when `WORKER_API_URL` enqueue fails and inline fallback is disabled (non-`local`). */
export class WorkerEnqueueFailedError extends Error {
	override readonly cause: unknown;

	constructor(cause: unknown) {
		super("worker_enqueue_failed");
		this.name = "WorkerEnqueueFailedError";
		this.cause = cause;
	}
}

/** In-process queue fallback only when `ENVIRONMENT=local` (see `.env.example`). */
function isWorkerEnqueueInlineFallbackEnabled(): boolean {
	return env.ENVIRONMENT === "local";
}

/**
 * Ask the Cloudflare Worker to enqueue Polar outbox processing. On failure when
 * `ENVIRONMENT=local`, drains in-process so dev works without `wrangler dev`.
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
		if (!isWorkerEnqueueInlineFallbackEnabled()) {
			console.error(
				"[enqueue] polar worker unreachable (inline fallback disabled; set ENVIRONMENT=local for dev)",
				err,
			);
			return;
		}
		console.warn(
			"[enqueue] worker unreachable, draining polar outbox inline",
			err,
		);
		void processPolarUsageSyncBatch({ limit: 25 }).catch((e) => {
			console.error("[polar_usage_sync] inline fallback failed", e);
		});
	}
}

export type EnqueueVideoJobDispatchInput = {
	jobId: string;
	userId: string;
	pipelineKind: string;
};

/**
 * Enqueue a `video_jobs` row for the Worker to dispatch back to this app.
 * When `ENVIRONMENT=local` and enqueue fails, runs {@link dispatchPipelineForJob} inline.
 */
export async function enqueueVideoJobDispatch(
	input: EnqueueVideoJobDispatchInput,
): Promise<void> {
	const base = env.WORKER_API_URL.replace(/\/$/, "");
	const url = `${base}/enqueue`;

	const body: VideoJobDispatchMessage = {
		kind: QUEUE_MESSAGE_KIND.videoJobDispatch,
		jobId: input.jobId.trim(),
		userId: input.userId.trim(),
		pipelineKind: input.pipelineKind.trim(),
	};

	try {
		const res = await fetch(url, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${env.WORKER_SECRET}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(8000),
		});

		if (!res.ok) {
			throw new Error(`enqueue ${res.status}: ${await res.text()}`);
		}
	} catch (err) {
		if (isWorkerEnqueueInlineFallbackEnabled()) {
			console.warn(
				"[enqueue] worker unreachable, running video pipeline inline",
				err,
			);
			try {
				await dispatchPipelineForJob(input);
			} catch (e) {
				const message =
					e instanceof Error ? e.message : "video_pipeline_inline_failed";
				console.error("[video_job_dispatch] inline fallback failed", e);
				await markVideoJobFailed({
					jobId: input.jobId,
					message,
				});
			}
			return;
		}

		console.error(
			"[enqueue] worker unreachable (inline fallback disabled; set ENVIRONMENT=local for dev)",
			err,
		);
		await markVideoJobFailed({
			jobId: input.jobId,
			message: "worker_enqueue_unreachable",
		});
		throw new WorkerEnqueueFailedError(err);
	}
}
