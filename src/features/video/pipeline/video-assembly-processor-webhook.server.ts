import "@tanstack/react-start/server-only";

import { videoJobAssemblyOutputKey } from "@klipse/video-assembly-shared";
import { and, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db";
import { videoJobs } from "@/db/schema/video-jobs";
import { mysqlAffectedRowsFromUpdateResult } from "@/lib/db/mysql-affected-rows.server";
import { publicUrlForR2Key } from "@/lib/storage/r2.server";
import { markFreeTierVideoConsumedIfNeeded } from "./free-tier-video-consumed.server";
import { PIPELINE_STAGE } from "./pipeline-kind";
import { markVideoJobFailed } from "./process-stub-pipeline.server";
import { runAfterVideoRenderComplete } from "./video-job-after-render.server";

export type VideoProcessorWebhookInput = {
	jobId: string;
	userId: string;
	status: "completed" | "failed";
	error?: string;
};

export type VideoProcessorWebhookResult =
	| { ok: true; replayed: boolean }
	| { ok: false; code: "job_not_found" | "user_mismatch" | "invalid_state" };

/**
 * Idempotent: duplicate webhooks for the same terminal state return `{ replayed: true }`.
 */
export async function applyVideoProcessorWebhook(
	input: VideoProcessorWebhookInput,
): Promise<VideoProcessorWebhookResult> {
	const db = getDb();
	const jobId = input.jobId.trim();
	const userId = input.userId.trim();

	const [job] = await db
		.select({
			id: videoJobs.id,
			userId: videoJobs.userId,
			channelId: videoJobs.channelId,
			status: videoJobs.status,
		})
		.from(videoJobs)
		.where(eq(videoJobs.id, jobId))
		.limit(1);

	if (!job) {
		return { ok: false, code: "job_not_found" };
	}
	if (job.userId !== userId) {
		return { ok: false, code: "user_mismatch" };
	}

	if (job.status === "completed" || job.status === "failed") {
		if (input.status === "completed" && job.status === "completed") {
			return { ok: true, replayed: true };
		}
		if (input.status === "failed" && job.status === "failed") {
			return { ok: true, replayed: true };
		}
		return { ok: false, code: "invalid_state" };
	}

	const readyForWebhook =
		job.status === "dispatched" || job.status === "processing";

	if (input.status === "completed") {
		if (!readyForWebhook) {
			return { ok: false, code: "invalid_state" };
		}

		const key = videoJobAssemblyOutputKey(userId, jobId);
		const outputUrl = publicUrlForR2Key(key);

		const updateResult = await db
			.update(videoJobs)
			.set({
				status: "completed",
				progress: 100,
				currentStage: PIPELINE_STAGE.DONE,
				outputUrl,
				errorMessage: null,
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(videoJobs.id, jobId),
					eq(videoJobs.userId, userId),
					inArray(videoJobs.status, ["dispatched", "processing"]),
				),
			);

		if (mysqlAffectedRowsFromUpdateResult(updateResult) === 0) {
			const [again] = await db
				.select({ status: videoJobs.status })
				.from(videoJobs)
				.where(eq(videoJobs.id, jobId))
				.limit(1);
			if (again?.status === "completed") {
				return { ok: true, replayed: true };
			}
			return { ok: false, code: "invalid_state" };
		}

		await markFreeTierVideoConsumedIfNeeded(userId);

		await runAfterVideoRenderComplete({
			jobId,
			userId,
			channelId: job.channelId,
			logicalKey: key,
		});

		return { ok: true, replayed: false };
	}

	if (!readyForWebhook) {
		return { ok: false, code: "invalid_state" };
	}

	const message = (input.error ?? "processor_failed").trim().slice(0, 4000);
	await markVideoJobFailed({ jobId, message });
	return { ok: true, replayed: false };
}
