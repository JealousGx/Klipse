import "@tanstack/react-start/server-only"

import { and, eq, isNull } from "drizzle-orm"

import { getDb } from "@/db"
import { channels } from "@/db/schema/channels"
import { users } from "@/db/schema/users"
import { videoJobs } from "@/db/schema/video-jobs"
import { env } from "@/env"
import { planAllowsPaidPublishingConnections } from "@/features/billing/tier-config"
import {
	clearOAuthRefreshTokenOnly,
	getOAuthRefreshTokenForChannel,
} from "@/features/channels/channels.service.server"
import type { MeResponse } from "@/features/user/types/me"
import {
	GoogleOAuthRefreshTokenInvalidError,
	refreshYoutubeAccessToken,
} from "@/features/youtube/youtube-oauth-tokens.server"
import { mysqlAffectedRowsFromUpdateResult } from "@/lib/db/mysql-affected-rows.server"
import { sendYoutubeDisconnectEmail } from "@/lib/email/youtube-disconnect-email"
import { logger } from "@/lib/logger"
import { captureException } from "@/lib/sentry"
import { buildYoutubeVideoMetadata } from "./build-youtube-video-metadata.server"
import { uploadMp4ToYoutube } from "./youtube-upload-api.server"

export type RunYoutubePublishForJobResult =
	| { ok: true; skipped: true; reason: string }
	| { ok: true; skipped: false; youtubeVideoId: string }
	| { ok: false; error: string }

/**
 * Idempotent YouTube upload for one `video_jobs` row (FEATURE_DOC §2.12).
 */
export async function runYoutubePublishForJob(input: {
	jobId: string
	userId: string
}): Promise<RunYoutubePublishForJobResult> {
	const db = getDb()
	const jobId = input.jobId.trim()
	const userId = input.userId.trim()

	const claimResult = await db.transaction(async (tx) => {
		const [job] = await tx
			.select()
			.from(videoJobs)
			.where(and(eq(videoJobs.id, jobId), eq(videoJobs.userId, userId)))
			.for("update")
			.limit(1)

		if (!job) {
			return { kind: "skip" as const, reason: "job_not_found" }
		}

		if (job.publishedVideoId?.trim()) {
			return { kind: "skip" as const, reason: "already_published" }
		}

		if (job.status !== "completed" || !job.outputUrl?.trim()) {
			return { kind: "skip" as const, reason: "job_not_ready" }
		}

		if (job.publishApprovalStatus === "pending") {
			return { kind: "skip" as const, reason: "awaiting_manual_approval" }
		}
		if (job.publishApprovalStatus === "rejected") {
			return { kind: "skip" as const, reason: "publish_rejected" }
		}

		const [u] = await tx
			.select({ plan: users.plan, email: users.email })
			.from(users)
			.where(eq(users.id, userId))
			.limit(1)
		const plan = (u?.plan ?? "free") as MeResponse["plan"]
		if (!planAllowsPaidPublishingConnections(plan)) {
			return { kind: "skip" as const, reason: "plan_blocked" }
		}

		const [ch] = await tx
			.select({
				id: channels.id,
				platform: channels.platform,
				name: channels.name,
				niche: channels.niche,
			})
			.from(channels)
			.where(and(eq(channels.id, job.channelId), eq(channels.userId, userId)))
			.for("update")
			.limit(1)

		if (!ch || ch.platform !== "youtube") {
			return { kind: "skip" as const, reason: "channel_not_youtube" }
		}

		const upd = await tx
			.update(videoJobs)
			.set({
				publishStartedAt: new Date(),
				publishLastError: null,
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(videoJobs.id, jobId),
					eq(videoJobs.userId, userId),
					isNull(videoJobs.publishedVideoId),
					isNull(videoJobs.publishStartedAt),
				),
			)

		if (mysqlAffectedRowsFromUpdateResult(upd) === 0) {
			return { kind: "skip" as const, reason: "claim_lost_or_in_progress" }
		}

		return {
			kind: "claimed" as const,
			job,
			channelName: ch.name,
			niche: ch.niche,
			userEmail: u?.email ?? null,
		}
	})

	if (claimResult.kind === "skip") {
		return { ok: true, skipped: true, reason: claimResult.reason }
	}

	const { job, channelName, userEmail } = claimResult

	const baseUrl =
		env.SERVER_URL?.replace(/\/$/, "") ||
		env.VITE_APP_URL?.replace(/\/$/, "") ||
		""
	const publishingUrl = `${baseUrl}/dashboard/publishing`

	let refreshToken: string | null
	try {
		refreshToken = await getOAuthRefreshTokenForChannel(userId, job.channelId)
	} catch {
		refreshToken = null
	}
	if (!refreshToken?.trim()) {
		// Only notify once — skip if the previous attempt already set this exact error.
		const isFirstDisconnect =
			job.publishLastError !== "missing_oauth_refresh_token"
		if (isFirstDisconnect && userEmail) {
			sendYoutubeDisconnectEmail({
				to: userEmail,
				channelName,
				publishingUrl,
			}).catch((err) =>
				logger.error("[youtube-publish] disconnect email failed", {
					jobId,
					error: err instanceof Error ? err.message : String(err),
				}),
			)
		}
		await clearPublishAttempt(jobId, userId, "missing_oauth_refresh_token")
		return { ok: false, error: "missing_oauth_refresh_token" }
	}

	let accessToken: string
	try {
		const tok = await refreshYoutubeAccessToken(refreshToken)
		accessToken = tok.access_token
	} catch (e) {
		if (e instanceof GoogleOAuthRefreshTokenInvalidError) {
			await clearOAuthRefreshTokenOnly({ userId, channelId: job.channelId })
			// Token is now gone — notify user to reconnect (same email as missing-token path).
			if (userEmail) {
				sendYoutubeDisconnectEmail({
					to: userEmail,
					channelName,
					publishingUrl,
				}).catch((err) =>
					logger.error("[youtube-publish] disconnect email failed", {
						jobId,
						error: err instanceof Error ? err.message : String(err),
					}),
				)
			}
		}
		const msg = e instanceof Error ? e.message : "youtube_token_refresh_failed"
		captureException(e, { jobId, userId, stage: "youtube_token_refresh" })
		await clearPublishAttempt(jobId, userId, msg)
		return { ok: false, error: msg }
	}

	const outputUrl = job.outputUrl?.trim()
	if (!outputUrl) {
		await clearPublishAttempt(jobId, userId, "missing_output_url")
		return { ok: false, error: "missing_output_url" }
	}

	let videoBytes: Buffer
	try {
		const res = await fetch(outputUrl, {
			redirect: "follow",
			signal: AbortSignal.timeout(600_000),
		})
		if (!res.ok) {
			throw new Error(`fetch_output_failed:${res.status}`)
		}
		const ab = await res.arrayBuffer()
		videoBytes = Buffer.from(ab)
	} catch (e) {
		const msg = e instanceof Error ? e.message : "fetch_output_failed"
		captureException(e, {
			jobId,
			userId,
			stage: "fetch_output_url",
			outputUrl,
		})
		await clearPublishAttempt(jobId, userId, msg)
		return { ok: false, error: msg }
	}

	const metadata = buildYoutubeVideoMetadata({
		channelName,
		artifacts: job.artifacts,
		inputPayload: job.inputPayload,
		aiDisclosure: true,
	})

	try {
		const { videoId } = await uploadMp4ToYoutube({
			accessToken,
			metadata,
			videoBytes,
		})

		await db
			.update(videoJobs)
			.set({
				publishedVideoId: videoId,
				publishedAt: new Date(),
				publishStartedAt: null,
				publishLastError: null,
				updatedAt: new Date(),
			})
			.where(and(eq(videoJobs.id, jobId), eq(videoJobs.userId, userId)))

		return { ok: true, skipped: false, youtubeVideoId: videoId }
	} catch (e) {
		const msg = e instanceof Error ? e.message : "youtube_upload_failed"
		captureException(e, { jobId, userId, stage: "youtube_upload" })
		await clearPublishAttempt(jobId, userId, msg)
		return { ok: false, error: msg }
	}
}

async function clearPublishAttempt(
	jobId: string,
	userId: string,
	errorMessage: string,
): Promise<void> {
	const db = getDb()
	await db
		.update(videoJobs)
		.set({
			publishStartedAt: null,
			publishLastError: errorMessage.slice(0, 4000),
			updatedAt: new Date(),
		})
		.where(and(eq(videoJobs.id, jobId), eq(videoJobs.userId, userId)))
}
