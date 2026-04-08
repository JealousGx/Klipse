import "@tanstack/react-start/server-only";

import {
	QUEUE_MESSAGE_KIND,
	type PlatformPublishMessage,
	type VideoJobDispatchMessage,
} from "@klipse/worker-contracts";

import { getDb } from "@/db";
import { users } from "@/db/schema/users";
import { env } from "@/env";
import { runYoutubePublishForJob } from "@/features/publishing/youtube/run-youtube-publish-for-job.server";
import { markVideoJobFailed } from "@/features/video/pipeline/process-stub-pipeline.server";
import { dispatchPipelineForJob } from "@/features/video/pipeline/process-video-job-dispatch.server";
import { eq } from "drizzle-orm";

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

/** Paid plans get the high-throughput queue; free tier waits in the low-priority queue. */
function isPriorityPlan(plan: string): boolean {
	return plan !== "free";
}

async function resolveUserPlan(userId: string): Promise<string> {
	const db = getDb();
	const [row] = await db
		.select({ plan: users.plan })
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);
	return row?.plan ?? "free";
}

async function postToWorkerEnqueue(
	body: Record<string, unknown>,
): Promise<void> {
	const base = env.WORKER_API_URL.replace(/\/$/, "");
	const res = await fetch(`${base}/enqueue`, {
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
}

// ---------------------------------------------------------------------------
// Video job dispatch
// ---------------------------------------------------------------------------

export type EnqueueVideoJobDispatchInput = {
	jobId: string;
	userId: string;
	pipelineKind: string;
};

/**
 * Enqueue a `video_jobs` row for the Worker to dispatch back to this app.
 * Resolves the user's plan to route to the priority or free-tier queue.
 * When `ENVIRONMENT=local` and the Worker is unreachable, runs inline as fallback.
 */
export async function enqueueVideoJobDispatch(
	input: EnqueueVideoJobDispatchInput,
): Promise<void> {
	const message: VideoJobDispatchMessage = {
		kind: QUEUE_MESSAGE_KIND.videoJobDispatch,
		jobId: input.jobId.trim(),
		userId: input.userId.trim(),
		pipelineKind: input.pipelineKind.trim(),
	};

	try {
		const plan = await resolveUserPlan(input.userId);
		await postToWorkerEnqueue({ ...message, isPriority: isPriorityPlan(plan) });
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
				await markVideoJobFailed({ jobId: input.jobId, message });
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

// ---------------------------------------------------------------------------
// Platform publish
// ---------------------------------------------------------------------------

export type EnqueuePlatformPublishInput = {
	jobId: string;
	userId: string;
	platform: PlatformPublishMessage["platform"];
};

/**
 * Enqueue a completed render for publishing to the given platform.
 * When `ENVIRONMENT=local` and the Worker is unreachable, runs inline (YouTube only for now).
 */
export async function enqueuePlatformPublish(
	input: EnqueuePlatformPublishInput,
): Promise<void> {
	const message: PlatformPublishMessage = {
		kind: QUEUE_MESSAGE_KIND.platformPublish,
		jobId: input.jobId.trim(),
		userId: input.userId.trim(),
		platform: input.platform,
	};

	try {
		const plan = await resolveUserPlan(input.userId);
		await postToWorkerEnqueue({ ...message, isPriority: isPriorityPlan(plan) });
	} catch (err) {
		if (isWorkerEnqueueInlineFallbackEnabled()) {
			console.warn(
				"[enqueue] worker unreachable, running platform_publish inline",
				err,
			);
			if (input.platform === "youtube") {
				await runYoutubePublishForJob({
					jobId: input.jobId,
					userId: input.userId,
				});
			} else {
				console.info(
					"[enqueue] inline fallback not implemented for platform",
					input.platform,
				);
			}
			return;
		}
		console.error(
			"[enqueue] platform_publish worker unreachable (inline fallback disabled; set ENVIRONMENT=local for dev)",
			err,
		);
	}
}
