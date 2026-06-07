import "@tanstack/react-start/server-only"

import { getOAuthRefreshTokenForChannel } from "@/features/channels/channels.service.server"
import {
	fetchTiktokCreatorInfo,
	refreshTiktokAccessToken,
	TiktokOAuthRefreshTokenInvalidError,
	TiktokPostCapReachedError,
} from "@/features/tiktok/tiktok-oauth-tokens.server"
import { logger } from "@/lib/logger"
import type { TiktokPublishOptionsResult } from "./tiktok-publish.functions"

/**
 * Fetches live TikTok creator info for a channel so the approval UI can
 * show the correct privacy options and creator account details.
 * Requires a valid stored OAuth refresh token for the channel.
 */
export async function getTiktokPublishOptions(
	userId: string,
	channelId: string,
): Promise<TiktokPublishOptionsResult> {
	let refreshToken: string | null
	try {
		refreshToken = await getOAuthRefreshTokenForChannel(userId, channelId)
	} catch {
		refreshToken = null
	}

	if (!refreshToken?.trim()) {
		return { ok: false, code: "no_token" }
	}

	let accessToken: string
	try {
		const refreshed = await refreshTiktokAccessToken(refreshToken)
		accessToken = refreshed.access_token
	} catch (e) {
		if (e instanceof TiktokOAuthRefreshTokenInvalidError) {
			return { ok: false, code: "token_invalid" }
		}
		logger.error("tiktok_publish_options_token_refresh_failed", {
			channelId,
			error: e instanceof Error ? e.message : String(e),
		})
		return { ok: false, code: "fetch_failed" }
	}

	try {
		const creator = await fetchTiktokCreatorInfo(accessToken)
		return {
			ok: true,
			privacyLevelOptions: creator.privacyLevelOptions,
			creatorNickname: creator.creatorNickname,
			creatorHandle: creator.creatorUsername,
			maxVideoPostDurationSec: creator.maxVideoPostDurationSec,
		}
	} catch (e) {
		if (e instanceof TiktokPostCapReachedError) {
			return { ok: false, code: "post_cap_reached" }
		}
		logger.error("tiktok_publish_options_creator_info_failed", {
			channelId,
			error: e instanceof Error ? e.message : String(e),
		})
		return { ok: false, code: "fetch_failed" }
	}
}
