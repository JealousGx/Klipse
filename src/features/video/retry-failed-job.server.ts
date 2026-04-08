import "@tanstack/react-start/server-only";

import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { videoJobs } from "@/db/schema/video-jobs";
import { mysqlAffectedRowsFromUpdateResult } from "@/lib/db/mysql-affected-rows.server";
import { enqueueVideoJobDispatch } from "@/lib/worker/enqueue.server";

import { PIPELINE_STAGE } from "./pipeline/pipeline-kind";

/** Maximum number of manual retries allowed per job (FEATURE_DOC §DLQ). */
export const MAX_MANUAL_RETRIES = 3;

export type RetryFailedJobResult =
	| { ok: true }
	| { ok: false; code: "not_found" | "not_failed" | "max_retries" };

/**
 * Re-enqueue a `failed` job for the given user.
 *
 * - Enforces ownership (`userId` must match).
 * - Enforces `status === "failed"`.
 * - Enforces `retryCount < MAX_MANUAL_RETRIES` (capped at 3).
 * - Resets the job to `queued` and increments `retryCount` atomically; only
 *   enqueues if the DB update succeeds (guards against concurrent retries).
 * - Does **not** re-charge credits — the original deduction stands.
 */
export async function retryFailedJobForUser(input: {
	userId: string;
	jobId: string;
}): Promise<RetryFailedJobResult> {
	const db = getDb();
	const jobId = input.jobId.trim();

	const [row] = await db
		.select({
			id: videoJobs.id,
			userId: videoJobs.userId,
			status: videoJobs.status,
			pipelineKind: videoJobs.pipelineKind,
			retryCount: videoJobs.retryCount,
		})
		.from(videoJobs)
		.where(and(eq(videoJobs.id, jobId), eq(videoJobs.userId, input.userId)))
		.limit(1);

	if (!row) {
		return { ok: false, code: "not_found" };
	}
	if (row.status !== "failed") {
		return { ok: false, code: "not_failed" };
	}
	if (row.retryCount >= MAX_MANUAL_RETRIES) {
		return { ok: false, code: "max_retries" };
	}

	// Optimistically update — the WHERE clause on `status = 'failed'` prevents
	// a concurrent retry from racing to enqueue twice.
	const result = await db
		.update(videoJobs)
		.set({
			status: "queued",
			progress: 0,
			currentStage: PIPELINE_STAGE.QUEUED,
			errorMessage: null,
			retryCount: row.retryCount + 1,
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(videoJobs.id, jobId),
				eq(videoJobs.userId, input.userId),
				eq(videoJobs.status, "failed"),
			),
		);

	if (mysqlAffectedRowsFromUpdateResult(result) === 0) {
		// Another concurrent request already retried (or status changed) — treat as not_failed.
		return { ok: false, code: "not_failed" };
	}

	await enqueueVideoJobDispatch({
		jobId,
		userId: input.userId,
		pipelineKind: row.pipelineKind,
	});

	return { ok: true };
}
