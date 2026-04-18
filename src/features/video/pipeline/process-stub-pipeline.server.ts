import "@tanstack/react-start/server-only";

import { and, eq, notInArray } from "drizzle-orm";

import { getDb } from "@/db";
import { videoJobs } from "@/db/schema/video-jobs";
import { logger } from "@/lib/logger";

/**
 * If post-commit processing fails, surface a failed job instead of leaving it queued forever.
 */
export async function markVideoJobFailed(input: {
	jobId: string;
	message: string;
}): Promise<void> {
	const db = getDb();
	const msg = input.message.trim().slice(0, 4000);
	logger.warn("job_marked_failed", { jobId: input.jobId.trim(), message: msg });

	await db
		.update(videoJobs)
		.set({
			status: "failed",
			progress: 0,
			currentStage: "failed",
			errorMessage: msg || "Pipeline error",
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(videoJobs.id, input.jobId.trim()),
				notInArray(videoJobs.status, ["completed", "failed"]),
			),
		);
}
