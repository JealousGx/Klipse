import "@tanstack/react-start/server-only";

import {
	QUEUE_MESSAGE_KIND,
	type VideoJobDispatchMessage,
} from "@klipse/worker-contracts";

import { env } from "@/env";
import { processPolarUsageSyncBatch } from "@/features/billing/polar-usage-sync-process.server";
import { markVideoJobFailed } from "@/features/video/pipeline/process-stub-pipeline.server";
import { dispatchPipelineForJob } from "@/features/video/pipeline/process-video-job-dispatch.server";

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

export type EnqueueVideoJobDispatchInput = {
	jobId: string;
	userId: string;
	pipelineKind: string;
};

/**
 * Enqueue a `video_jobs` row for the Worker to dispatch back to this app. If the Worker
 * is unreachable (local dev without `wrangler dev`), runs {@link dispatchPipelineForJob}
 * inline so jobs still complete.
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
	}
}
