import "@tanstack/react-start/server-only"

import { and, desc, eq, lt, or } from "drizzle-orm"

import { getDb } from "@/db"
import { channels } from "@/db/schema/channels"
import { expiringAssets } from "@/db/schema/expiring-assets"
import { users } from "@/db/schema/users"
import { videoJobs } from "@/db/schema/video-jobs"
import {
	PLATFORM_REQUIRED_TERMS,
	parseChannelConfig,
} from "@/features/channels/channel-config.schema"
import { requestPlatformPublishForJob } from "@/features/publishing/request-platform-publish.server"

import { LIST_JOBS_DEFAULT_PAGE_SIZE } from "./video-job-constants"
import type { VideoJobListRow } from "./video-job-list.types"

export type { VideoJobListRow } from "./video-job-list.types"

export type VideoJobCursor = { createdAt: Date; id: string }

export type ListVideoJobsResult = {
	jobs: VideoJobListRow[]
	nextCursor: VideoJobCursor | null
}

export async function listVideoJobsForUser(
	userId: string,
	cursor?: VideoJobCursor,
	pageSize = LIST_JOBS_DEFAULT_PAGE_SIZE,
): Promise<ListVideoJobsResult> {
	const db = getDb()

	const whereCondition = cursor
		? and(
				eq(videoJobs.userId, userId),
				or(
					lt(videoJobs.createdAt, cursor.createdAt),
					and(
						eq(videoJobs.createdAt, cursor.createdAt),
						lt(videoJobs.id, cursor.id),
					),
				),
			)
		: eq(videoJobs.userId, userId)

	const rows = await db
		.select({
			id: videoJobs.id,
			channelId: videoJobs.channelId,
			pipelineKind: videoJobs.pipelineKind,
			channelName: channels.name,
			channelNiche: channels.niche,
			channelPlatform: channels.platform,
			channelExternalHandle: channels.externalChannelHandle,
			channelExternalTitle: channels.externalChannelTitle,
			status: videoJobs.status,
			progress: videoJobs.progress,
			currentStage: videoJobs.currentStage,
			costCredits: videoJobs.costCredits,
			outputUrl: videoJobs.outputUrl,
			errorMessage: videoJobs.errorMessage,
			publishApprovalStatus: videoJobs.publishApprovalStatus,
			publishedVideoId: videoJobs.publishedVideoId,
			publishLastError: videoJobs.publishLastError,
			publishStartedAt: videoJobs.publishStartedAt,
			retryCount: videoJobs.retryCount,
			publishRetryCount: videoJobs.publishRetryCount,
			outputStorageExpiresAt: expiringAssets.expiresAt,
			createdAt: videoJobs.createdAt,
			artifacts: videoJobs.artifacts,
		})
		.from(videoJobs)
		.innerJoin(channels, eq(videoJobs.channelId, channels.id))
		.leftJoin(
			expiringAssets,
			and(
				eq(expiringAssets.videoJobId, videoJobs.id),
				eq(expiringAssets.kind, "output"),
			),
		)
		.where(whereCondition)
		.orderBy(desc(videoJobs.createdAt), desc(videoJobs.id))
		.limit(pageSize + 1)

	const hasNextPage = rows.length > pageSize
	const jobs = hasNextPage ? rows.slice(0, pageSize) : rows
	const lastJob = jobs[jobs.length - 1]
	const nextCursor =
		hasNextPage && lastJob
			? { createdAt: lastJob.createdAt, id: lastJob.id }
			: null

	return { jobs, nextCursor }
}

export async function setPublishApprovalForUser(input: {
	userId: string
	jobId: string
	decision: "approved" | "rejected"
	/** User-edited caption set during pre-publish review. Stored and used instead of auto-generated. */
	captionOverride?: string
	/** User-selected publish settings (privacy level, TikTok disclosure). Stored on the job. */
	publishSettings?: import("@/db/schema/video-jobs").VideoJobPublishSettings
}): Promise<
	| { ok: true }
	| { ok: false; code: "not_found" | "invalid_state" | "terms_not_confirmed" }
> {
	const db = getDb()
	const jobId = input.jobId.trim()

	// Join channels + users in one query to get everything needed for dispatch.
	const [row] = await db
		.select({
			id: videoJobs.id,
			userId: videoJobs.userId,
			publishApprovalStatus: videoJobs.publishApprovalStatus,
			status: videoJobs.status,
			channelPlatform: channels.platform,
			channelConfig: channels.config,
			userPlan: users.plan,
		})
		.from(videoJobs)
		.innerJoin(channels, eq(videoJobs.channelId, channels.id))
		.innerJoin(users, eq(videoJobs.userId, users.id))
		.where(eq(videoJobs.id, jobId))
		.limit(1)

	if (!row || row.userId !== input.userId) {
		return { ok: false, code: "not_found" }
	}
	if (row.publishApprovalStatus !== "pending") {
		return { ok: false, code: "invalid_state" }
	}
	if (row.status !== "completed") {
		return { ok: false, code: "invalid_state" }
	}

	// Check required platform terms are confirmed before allowing approval.
	if (input.decision === "approved") {
		const requiredTerms = PLATFORM_REQUIRED_TERMS[row.channelPlatform] ?? []
		if (requiredTerms.length > 0) {
			const config = parseChannelConfig(row.channelConfig)
			const confirmed = new Set(config.confirmed_terms)
			const missing = requiredTerms.filter((t) => !confirmed.has(t))
			if (missing.length > 0) {
				return { ok: false, code: "terms_not_confirmed" }
			}
		}
	}

	await db
		.update(videoJobs)
		.set({
			publishApprovalStatus: input.decision,
			...(input.captionOverride?.trim()
				? {
						publishCaptionOverride: input.captionOverride.trim().slice(0, 5000),
					}
				: {}),
			...(input.publishSettings
				? { publishSettings: input.publishSettings }
				: {}),
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(videoJobs.id, jobId),
				eq(videoJobs.userId, input.userId),
				eq(videoJobs.publishApprovalStatus, "pending"),
			),
		)

	if (input.decision === "approved" && row.channelPlatform !== "unlinked") {
		await requestPlatformPublishForJob({
			jobId,
			userId: input.userId,
			// channelPlatform is "youtube" | "tiktok" | "instagram" after the unlinked guard above
			platform: row.channelPlatform as "youtube" | "tiktok" | "instagram",
		})
	}

	return { ok: true }
}
