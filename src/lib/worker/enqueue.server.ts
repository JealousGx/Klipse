import "@tanstack/react-start/server-only";

import {
	QUEUE_MESSAGE_KIND,
	type VideoJobDispatchMessage,
	type YoutubePublishMessage,
} from "@klipse/worker-contracts";

import { env } from "@/env";
import { runYoutubePublishForJob } from "@/features/publishing/youtube/run-youtube-publish-for-job.server";
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

export type EnqueueYoutubePublishInput = {
	jobId: string;
	userId: string;
};

/**
 * Enqueue YouTube upload (§2.15 publishing queue). Heavy work runs on the main app via Worker callback.
 * When `ENVIRONMENT=local` and enqueue fails, runs {@link runYoutubePublishForJob} inline.
 */
export async function enqueueYoutubePublish(
	input: EnqueueYoutubePublishInput,
): Promise<void> {
	const base = env.WORKER_API_URL.replace(/\/$/, "");
	const url = `${base}/enqueue`;

	const body: YoutubePublishMessage = {
		kind: QUEUE_MESSAGE_KIND.youtubePublish,
		jobId: input.jobId.trim(),
		userId: input.userId.trim(),
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
				"[enqueue] worker unreachable, running youtube_publish inline",
				err,
			);
			await runYoutubePublishForJob(input);
			return;
		}
		console.error(
			"[enqueue] youtube_publish worker unreachable (inline fallback disabled; set ENVIRONMENT=local for dev)",
			err,
		);
	}
}
