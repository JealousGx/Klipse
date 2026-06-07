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
	exchangeTiktokAuthorizationCode,
	fetchTiktokCreatorInfo,
	tiktokOAuthGrantsAllRequiredScopes,
} from "@/features/tiktok/tiktok-oauth-tokens.server"
import { auth } from "@/lib/auth"
import { logger } from "@/lib/logger"
import { verifyTiktokOAuthState } from "@/middleware/tiktok-oauth-state"

/**
 * TikTok redirects here with `code` + `state`. Exchanges tokens, fetches creator
 * info, and persists the refresh token + metadata on the destination row.
 */
export const Route = createFileRoute("/api/tiktok/oauth/callback")({
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

				if (!env.TIKTOK_OAUTH_STATE_SECRET) {
					return redirectBack(
						"/dashboard/publishing?oauth=error&reason=tiktok_not_configured",
					)
				}

				const payload = verifyTiktokOAuthState(
					state,
					env.TIKTOK_OAUTH_STATE_SECRET,
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

				// Must match the redirect_uri used in the start route exactly.
				const baseUrl =
					env.ENVIRONMENT === "local"
						? "https://barstool-charcoal-battle.ngrok-free.dev"
						: (env.APP_PUBLIC_URL?.replace(/\/$/, "") ?? origin)
				const redirectUri = `${baseUrl}/api/tiktok/oauth/callback`

				try {
					const tokens = await exchangeTiktokAuthorizationCode({
						code,
						redirectUri,
						codeVerifier: payload.cv,
					})

					// Verify granted scopes include everything we need.
					if (!tiktokOAuthGrantsAllRequiredScopes(tokens.scope)) {
						return redirectBack(
							`/dashboard/publishing/${payload.c}?oauth=error&reason=${encodeURIComponent("tiktok_scopes_incomplete")}`,
						)
					}

					// Fetch creator info for display metadata and to confirm token works.
					const creator = await fetchTiktokCreatorInfo(tokens.access_token)

					const destination = await getChannelForUser(
						session.user.id,
						payload.c,
					)
					if (!destination) {
						return redirectBack(
							`/dashboard/publishing/${payload.c}?oauth=error&reason=not_found`,
						)
					}

					// Prevent connecting a different TikTok account to an already-bound slot.
					const lockedId =
						destination.boundExternalAccountId ?? destination.externalChannelId
					if (lockedId && lockedId !== tokens.open_id) {
						return redirectBack(
							`/dashboard/publishing/${payload.c}?oauth=error&reason=${encodeURIComponent("wrong_tiktok_account")}`,
						)
					}

					// Prevent the same TikTok account from being linked to multiple destinations.
					const duplicateElsewhere =
						await userHasAnotherDestinationWithExternalChannelId({
							userId: session.user.id,
							excludeChannelId: payload.c,
							externalChannelId: tokens.open_id,
						})
					if (duplicateElsewhere) {
						return redirectBack(
							`/dashboard/publishing/${payload.c}?oauth=error&reason=${encodeURIComponent("tiktok_account_in_use")}`,
						)
					}

					const applied = await applyOAuthConnectionWithQuota({
						userId: payload.u,
						channelId: payload.c,
						platform: "tiktok",
						refreshToken: tokens.refresh_token,
						externalChannelId: tokens.open_id,
						externalChannelTitle: creator.creatorNickname || null,
						// Store without "@" prefix — platformChannelUrl prepends it when building URLs.
						externalChannelHandle: creator.creatorUsername || null,
						// Avatar URL has 2h TTL — stored for initial display only.
						externalChannelThumbnailUrl: creator.creatorAvatarUrl,
					})

					if (!applied.ok) {
						const reason =
							applied.code === "free_plan_blocked"
								? PUBLISHING_CONNECTION_DENIAL_REASONS.PAID_PLAN_REQUIRED
								: "destination_replacements_exhausted"
						logger.warn("tiktok_oauth_connect_denied", {
							userId: payload.u,
							channelId: payload.c,
							code: applied.code,
						})
						return redirectBack(
							`/dashboard/publishing/${payload.c}?oauth=error&reason=${encodeURIComponent(reason)}`,
						)
					}

					logger.info("tiktok_oauth_connect_success", {
						userId: payload.u,
						channelId: payload.c,
						openId: tokens.open_id,
						creatorNickname: creator.creatorNickname,
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
					logger.error("tiktok_oauth_callback_error", {
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
