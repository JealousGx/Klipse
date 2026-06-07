import "@tanstack/react-start/server-only"

import { and, eq } from "drizzle-orm"

import { getDb } from "@/db"
import { videoJobs } from "@/db/schema/video-jobs"
import {
	clearOAuthRefreshTokenOnly,
	updateChannelOAuthRefreshToken,
} from "@/features/channels/channels.service.server"
import {
	refreshTiktokAccessToken,
	TiktokOAuthRefreshTokenInvalidError,
} from "@/features/tiktok/tiktok-oauth-tokens.server"
import { sendTiktokDisconnectEmail } from "@/lib/email/tiktok-disconnect-email"
import { logger } from "@/lib/logger"
import { captureException } from "@/lib/sentry"

export type TokenRefreshResult =
	| { ok: true; accessToken: string }
	| { ok: false; error: string }

/**
 * Refreshes the TikTok access token and persists the new refresh token.
 * Handles disconnect emails on invalid_grant errors.
 */
export async function refreshTiktokToken(opts: {
	refreshToken: string
	userId: string
	channelId: string
	channelName: string
	jobId: string
	userEmail: string | null
	publishingUrl: string
}): Promise<TokenRefreshResult> {
	const {
		refreshToken,
		userId,
		channelId,
		channelName,
		jobId,
		userEmail,
		publishingUrl,
	} = opts

	try {
		const refreshed = await refreshTiktokAccessToken(refreshToken)

		// TikTok rotates refresh tokens — persist new one immediately before consuming.
		await updateChannelOAuthRefreshToken({
			userId,
			channelId,
			refreshToken: refreshed.new_refresh_token,
		})

		return { ok: true, accessToken: refreshed.access_token }
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
		return { ok: false, error: msg }
	}
}

/** Resets `publishStartedAt` and records `publishLastError` after a failed attempt. */
export async function clearPublishAttempt(
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
