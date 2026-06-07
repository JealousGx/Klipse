import { createFileRoute } from "@tanstack/react-router"

import { env } from "@/env"

import { ChannelNotFoundError } from "@/features/channels/channel-errors"
import {
	getChannelForUser,
	userHasAnotherDestinationWithExternalChannelId,
} from "@/features/channels/channels.service.server"
import { applyOAuthConnectionWithQuota } from "@/features/channels/destination-replacement-quota.server"
import { PUBLISHING_CONNECTION_DENIAL_REASONS } from "@/features/entitlements"
import {
	exchangeYoutubeAuthorizationCode,
	fetchYoutubeMineChannel,
	resolveYoutubeOAuthGrantedScopes,
	youtubeOAuthGrantsAllRequiredScopes,
} from "@/features/youtube/youtube-oauth-tokens.server"
import { auth } from "@/lib/auth"
import { logger } from "@/lib/logger"
import { verifyYoutubeOAuthState } from "@/middleware/youtube-oauth-state"

function formatHandle(customUrl: string | null): string | null {
	if (!customUrl?.trim()) {
		return null
	}
	const t = customUrl.trim()
	return t.startsWith("@") ? t : `@${t}`
}

/**
 * Google redirects here with `code` + `state`. Exchanges tokens, loads YouTube
 * channel (`mine=true`), persists refresh token + metadata on the destination row.
 */
export const Route = createFileRoute("/api/youtube/oauth/callback")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const url = new URL(request.url)
				const origin = url.origin
				const redirectBack = (path: string) =>
					Response.redirect(`${origin}${path}`, 302)

				const err = url.searchParams.get("error")
				const code = url.searchParams.get("code")
				const state = url.searchParams.get("state")

				if (err) {
					return redirectBack(
						`/dashboard/publishing?oauth=error&reason=${encodeURIComponent(err)}`,
					)
				}
				if (!code || !state) {
					return redirectBack(
						"/dashboard/publishing?oauth=error&reason=invalid",
					)
				}

				const payload = verifyYoutubeOAuthState(
					state,
					env.YOUTUBE_OAUTH_STATE_SECRET,
				)
				if (!payload) {
					return redirectBack("/dashboard/publishing?oauth=error&reason=state")
				}

				const session = await auth.api.getSession({ headers: request.headers })
				if (!session?.user || session.user.id !== payload.u) {
					return redirectBack(
						`/dashboard/publishing/${payload.c}?oauth=error&reason=session`,
					)
				}

				const redirectUri = `${origin}/api/youtube/oauth/callback`

				try {
					const tokens = await exchangeYoutubeAuthorizationCode({
						code,
						redirectUri,
					})
					if (!tokens.refresh_token) {
						return redirectBack(
							`/dashboard/publishing/${payload.c}?oauth=error&reason=no_refresh`,
						)
					}

					const grantedScope = await resolveYoutubeOAuthGrantedScopes({
						accessToken: tokens.access_token,
						scopeFromTokenResponse: tokens.scope,
					})
					if (!youtubeOAuthGrantsAllRequiredScopes(grantedScope)) {
						return redirectBack(
							`/dashboard/publishing/${payload.c}?oauth=error&reason=${encodeURIComponent("youtube_scopes_incomplete")}`,
						)
					}

					const yt = await fetchYoutubeMineChannel(tokens.access_token)

					const destination = await getChannelForUser(
						session.user.id,
						payload.c,
					)
					if (!destination) {
						return redirectBack(
							`/dashboard/publishing/${payload.c}?oauth=error&reason=not_found`,
						)
					}

					const lockedChannelId =
						destination.boundExternalAccountId ?? destination.externalChannelId
					if (lockedChannelId && lockedChannelId !== yt.id) {
						return redirectBack(
							`/dashboard/publishing/${payload.c}?oauth=error&reason=${encodeURIComponent("wrong_youtube_channel")}`,
						)
					}

					const duplicateElsewhere =
						await userHasAnotherDestinationWithExternalChannelId({
							userId: session.user.id,
							excludeChannelId: payload.c,
							externalChannelId: yt.id,
						})
					if (duplicateElsewhere) {
						return redirectBack(
							`/dashboard/publishing/${payload.c}?oauth=error&reason=${encodeURIComponent("youtube_channel_in_use")}`,
						)
					}

					const applied = await applyOAuthConnectionWithQuota({
						userId: payload.u,
						channelId: payload.c,
						platform: "youtube",
						refreshToken: tokens.refresh_token,
						externalChannelId: yt.id,
						externalChannelTitle: yt.title || null,
						externalChannelHandle: formatHandle(yt.customUrl),
						externalChannelThumbnailUrl: yt.thumbnailUrl,
					})
					if (!applied.ok) {
						const reason =
							applied.code === "free_plan_blocked"
								? PUBLISHING_CONNECTION_DENIAL_REASONS.PAID_PLAN_REQUIRED
								: "destination_replacements_exhausted"
						logger.warn("youtube_oauth_connect_denied", {
							userId: payload.u,
							channelId: payload.c,
							code: applied.code,
						})
						return redirectBack(
							`/dashboard/publishing/${payload.c}?oauth=error&reason=${encodeURIComponent(reason)}`,
						)
					}

					logger.info("youtube_oauth_connect_success", {
						userId: payload.u,
						channelId: payload.c,
						externalChannelId: yt.id,
						externalChannelTitle: yt.title,
					})

					return redirectBack(
						`/dashboard/publishing/${payload.c}?oauth=connected`,
					)
				} catch (e) {
					if (e instanceof ChannelNotFoundError) {
						return redirectBack(
							`/dashboard/publishing/${payload.c}?oauth=error&reason=not_found`,
						)
					}
					logger.error("youtube_oauth_callback_error", {
						userId: payload.u,
						channelId: payload.c,
						error: e instanceof Error ? e.message : String(e),
					})
					return redirectBack(
						`/dashboard/publishing/${payload.c}?oauth=error&reason=exchange`,
					)
				}
			},
		},
	},
})
