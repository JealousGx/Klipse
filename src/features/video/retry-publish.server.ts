import "@tanstack/react-start/server-only"

import { and, eq, sql } from "drizzle-orm"

import { getDb } from "@/db"
import { videoJobs } from "@/db/schema/video-jobs"
import { requestPlatformPublishForJob } from "@/features/publishing/request-platform-publish.server"
import { logger } from "@/lib/logger"

import { MAX_PUBLISH_RETRIES } from "./video-job-constants"

export { MAX_PUBLISH_RETRIES }

export type RetryPublishResult =
	| { ok: true }
	| {
			ok: false
			code:
				| "not_found"
				| "max_retries"
				| "already_published"
				| "not_ready"
				| "failed"
	  }

/**
 * Re-trigger platform publish for a completed job.
 *
 * - Enforces ownership + `publishRetryCount < MAX_PUBLISH_RETRIES`.
 * - Increments `publishRetryCount` atomically before dispatching.
 * - Platform-agnostic — works for YouTube, TikTok, and future platforms.
 */
export async function retryPublishForUser(input: {
	userId: string
	jobId: string
	platform: "youtube" | "tiktok" | "instagram"
}): Promise<RetryPublishResult> {
	const db = getDb()
	const jobId = input.jobId.trim()

	const [row] = await db
		.select({
			id: videoJobs.id,
			userId: videoJobs.userId,
			status: videoJobs.status,
			publishedVideoId: videoJobs.publishedVideoId,
			publishRetryCount: videoJobs.publishRetryCount,
		})
		.from(videoJobs)
		.where(and(eq(videoJobs.id, jobId), eq(videoJobs.userId, input.userId)))
		.limit(1)

	if (!row) {
		return { ok: false, code: "not_found" }
	}
	if (row.publishedVideoId?.trim()) {
		return { ok: false, code: "already_published" }
	}
	if (row.status !== "completed") {
		return { ok: false, code: "not_ready" }
	}
	if (row.publishRetryCount >= MAX_PUBLISH_RETRIES) {
		return { ok: false, code: "max_retries" }
	}

	// Increment before dispatching — prevents concurrent duplicate submissions.
	await db
		.update(videoJobs)
		.set({
			publishRetryCount: sql`${videoJobs.publishRetryCount} + 1`,
			updatedAt: new Date(),
		})
		.where(and(eq(videoJobs.id, jobId), eq(videoJobs.userId, input.userId)))

	try {
		await requestPlatformPublishForJob({
			jobId,
			userId: input.userId,
			platform: input.platform,
		})
		return { ok: true }
	} catch (e) {
		logger.error("retry_publish_dispatch_failed", {
			jobId,
			error: e instanceof Error ? e.message : String(e),
		})
		return { ok: false, code: "failed" }
	}
}
