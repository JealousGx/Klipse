import "@tanstack/react-start/server-only"

import { and, eq, inArray, isNull } from "drizzle-orm"

import { getDb } from "@/db"
import { channels } from "@/db/schema/channels"
import { users } from "@/db/schema/users"
import { videoJobs } from "@/db/schema/video-jobs"
import { planAllowsPaidPublishingConnections } from "@/features/billing/tier-config"
import { parseChannelConfig } from "@/features/channels/channel-config.schema"
import {
	clearOAuthRefreshTokenOnly,
	getOAuthRefreshTokenForChannel,
	updateChannelOAuthRefreshToken,
} from "@/features/channels/channels.service.server"
import {
	fetchTiktokCreatorInfo,
	refreshTiktokAccessToken,
	TiktokOAuthRefreshTokenInvalidError,
	TiktokPostCapReachedError,
} from "@/features/tiktok/tiktok-oauth-tokens.server"
import type { MeResponse } from "@/features/user/types/me"
import { mysqlAffectedRowsFromUpdateResult } from "@/lib/db/mysql-affected-rows.server"
import { sendTiktokDisconnectEmail } from "@/lib/email/tiktok-disconnect-email"
import { logger } from "@/lib/logger"
import { captureException } from "@/lib/sentry"
import { buildTiktokVideoCaption } from "./build-tiktok-video-caption.server"
import {
	initTiktokVideoUpload,
	pickBestPrivacyLevel,
	pollTiktokPublishStatus,
} from "./tiktok-upload-api.server"

export type RunTiktokPublishForJobResult =
	| { ok: true; skipped: true; reason: string }
	| {
			ok: true
			skipped: false
			publishId: string
			status: "PUBLISH_COMPLETE" | "SEND_TO_USER_INBOX"
	  }
	| { ok: false; error: string }

/**
 * Idempotent TikTok video publish for one `video_jobs` row.
 *
 * Flow: claim job → rotate token → query creator info → build caption →
 * init PULL_FROM_URL upload → poll until published/inbox → update job row.
 *
 * Note: TikTok refresh tokens rotate on every refresh. The new token is
 * persisted to DB before the old one is consumed.
 */
export async function runTiktokPublishForJob(input: {
	jobId: string
	userId: string
}): Promise<RunTiktokPublishForJobResult> {
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
				externalChannelId: channels.externalChannelId,
				config: channels.config,
			})
			.from(channels)
			.where(and(eq(channels.id, job.channelId), eq(channels.userId, userId)))
			.for("update")
			.limit(1)

		if (!ch || ch.platform !== "tiktok") {
			return { kind: "skip" as const, reason: "channel_not_tiktok" }
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
			channelId: ch.id,
			channelName: ch.name,
			channelConfig: parseChannelConfig(ch.config),
			userEmail: u?.email ?? null,
		}
	})

	if (claimResult.kind === "skip") {
		return { ok: true, skipped: true, reason: claimResult.reason }
	}

	const { job, channelId, channelName, channelConfig, userEmail } = claimResult

	const baseUrl =
		(typeof process !== "undefined" &&
			process.env?.SERVER_URL?.replace(/\/$/, "")) ||
		""
	const publishingUrl = `${baseUrl}/dashboard/publishing`

	// --- Token refresh ----------------------------------------------------------

	let refreshToken: string | null
	try {
		refreshToken = await getOAuthRefreshTokenForChannel(userId, channelId)
	} catch {
		refreshToken = null
	}

	if (!refreshToken?.trim()) {
		const isFirstDisconnect =
			job.publishLastError !== "missing_oauth_refresh_token"
		if (isFirstDisconnect && userEmail) {
			sendTiktokDisconnectEmail({
				to: userEmail,
				channelName,
				publishingUrl,
			}).catch((err) =>
				logger.error("tiktok_disconnect_email_failed", {
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
		const refreshed = await refreshTiktokAccessToken(refreshToken)
		accessToken = refreshed.access_token

		// TikTok rotates refresh tokens — persist new one immediately before consuming.
		await updateChannelOAuthRefreshToken({
			userId,
			channelId,
			refreshToken: refreshed.new_refresh_token,
		})
	} catch (e) {
		if (e instanceof TiktokOAuthRefreshTokenInvalidError) {
			await clearOAuthRefreshTokenOnly({ userId, channelId })
			if (userEmail) {
				sendTiktokDisconnectEmail({
					to: userEmail,
					channelName,
					publishingUrl,
				}).catch((err) =>
					logger.error("tiktok_disconnect_email_failed", {
						jobId,
						error: err instanceof Error ? err.message : String(err),
					}),
				)
			}
		}
		const msg = e instanceof Error ? e.message : "tiktok_token_refresh_failed"
		logger.error("tiktok_token_refresh_error", { jobId, error: msg })
		captureException(e, { jobId, userId, stage: "tiktok_token_refresh" })
		await clearPublishAttempt(jobId, userId, msg)
		return { ok: false, error: msg }
	}

	// --- Creator info + privacy level -------------------------------------------

	let privacyLevel: string
	let commentDisabled: boolean
	let duetDisabled: boolean
	let stitchDisabled: boolean
	let maxVideoPostDurationSec: number

	try {
		const creator = await fetchTiktokCreatorInfo(accessToken)
		// Priority: per-job override (re-enabled per-video controls) → channel default → auto-pick.
		const jobPrivacy = job.publishSettings?.privacyLevel?.trim()
		const channelDefaultPrivacy =
			channelConfig.tiktok_default_privacy_level?.trim()
		privacyLevel =
			jobPrivacy && creator.privacyLevelOptions.includes(jobPrivacy)
				? jobPrivacy
				: channelDefaultPrivacy &&
					  creator.privacyLevelOptions.includes(channelDefaultPrivacy)
					? channelDefaultPrivacy
					: pickBestPrivacyLevel(creator.privacyLevelOptions)
		commentDisabled = creator.commentDisabled
		duetDisabled = creator.duetDisabled
		stitchDisabled = creator.stitchDisabled
		maxVideoPostDurationSec = creator.maxVideoPostDurationSec
	} catch (e) {
		if (e instanceof TiktokPostCapReachedError) {
			logger.warn("tiktok_post_cap_reached", { jobId })
			await clearPublishAttempt(jobId, userId, "creator_post_cap_reached")
			return { ok: false, error: "creator_post_cap_reached" }
		}
		const msg = e instanceof Error ? e.message : "tiktok_creator_info_failed"
		logger.error("tiktok_creator_info_error", { jobId, error: msg })
		captureException(e, { jobId, userId, stage: "tiktok_creator_info" })
		await clearPublishAttempt(jobId, userId, msg)
		return { ok: false, error: msg }
	}

	// --- Duration check ---------------------------------------------------------

	const jobDurationSec = job.artifacts?.durationSec
	if (jobDurationSec && jobDurationSec > maxVideoPostDurationSec) {
		logger.warn("tiktok_duration_exceeds_limit", {
			jobId,
			jobDurationSec,
			maxVideoPostDurationSec,
		})
		await clearPublishAttempt(jobId, userId, "duration_exceeds_tiktok_limit")
		return { ok: false, error: "duration_exceeds_tiktok_limit" }
	}

	// --- Upload + poll ----------------------------------------------------------

	try {
		// User-edited caption override (set during pre-publish review) takes priority.
		const caption = job.publishCaptionOverride?.trim()
			? job.publishCaptionOverride.trim()
			: buildTiktokVideoCaption({
					artifacts: job.artifacts,
					inputPayload: job.inputPayload,
				})

		// Per-job disclosure overrides channel default (only set when per-video controls re-enabled).
		const disclosure =
			job.publishSettings?.tiktokDisclosure ??
			(channelConfig.tiktok_disclosure?.enabled
				? {
						enabled: channelConfig.tiktok_disclosure.enabled,
						brandOrganic: channelConfig.tiktok_disclosure.brand_organic,
						brandedContent: channelConfig.tiktok_disclosure.branded_content,
					}
				: undefined)
		const uploadParams = {
			accessToken,
			// outputUrl is guaranteed non-null — checked in the claim phase.
			videoUrl: job.outputUrl ?? "",
			caption,
			privacyLevel,
			commentDisabled,
			duetDisabled,
			stitchDisabled,
			disclosureEnabled: disclosure?.enabled ?? false,
			brandOrganic: disclosure?.brandOrganic ?? false,
			brandedContent: disclosure?.brandedContent ?? false,
		}

		const initResult = await initTiktokVideoUpload(uploadParams).catch(
			(e: unknown) => {
				// App not yet audited by TikTok — can only post as SELF_ONLY (private).
				// Retry with SELF_ONLY so the video still lands in the creator's account.
				// Once the app passes TikTok review this error will no longer occur.
				if (
					e instanceof Error &&
					e.message.includes(
						"unaudited_client_can_only_post_to_private_accounts",
					)
				) {
					logger.warn("tiktok_unaudited_fallback_to_self_only", {
						jobId,
						originalPrivacyLevel: privacyLevel,
					})
					return initTiktokVideoUpload({
						...uploadParams,
						privacyLevel: "SELF_ONLY",
					})
				}
				throw e
			},
		)
		const { publishId } = initResult

		const result = await pollTiktokPublishStatus({ accessToken, publishId })

		// Store publishId as the video identifier. TikTok's actual post_id becomes
		// available asynchronously (after moderation); publishId is usable for now.
		await db
			.update(videoJobs)
			.set({
				publishedVideoId: publishId,
				publishedAt: new Date(),
				publishStartedAt: null,
				publishLastError: null,
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(videoJobs.id, jobId),
					eq(videoJobs.userId, userId),
					inArray(videoJobs.status, ["completed"]),
				),
			)

		logger.info("tiktok_publish_complete", {
			jobId,
			publishId,
			tiktokStatus: result.status,
		})

		return { ok: true, skipped: false, publishId, status: result.status }
	} catch (e) {
		const msg = e instanceof Error ? e.message : "tiktok_upload_failed"
		logger.error("tiktok_upload_error", { jobId, error: msg })
		captureException(e, { jobId, userId, stage: "tiktok_upload" })
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
