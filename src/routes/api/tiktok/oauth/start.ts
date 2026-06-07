import { createHash, randomBytes } from "node:crypto"

import { createFileRoute } from "@tanstack/react-router"

import { env } from "@/env"
import { getChannelForUser } from "@/features/channels/channels.service.server"
import { getPublishingConnectionDenialReason } from "@/features/entitlements"
import { buildTiktokAuthorizeUrl } from "@/features/tiktok/tiktok-oauth-tokens.server"
import type { MeResponse } from "@/features/user/types/me"
import { auth } from "@/lib/auth"
import { signTiktokOAuthState } from "@/middleware/tiktok-oauth-state"

/**
 * Starts TikTok OAuth for video publishing. Requires session.
 * Query: `channelId` = Klipse publishing destination id.
 */
export const Route = createFileRoute("/api/tiktok/oauth/start")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const origin = new URL(request.url).origin
				const fail = (reason: string) =>
					Response.redirect(
						`${origin}/dashboard/publishing?tiktok=error&reason=${encodeURIComponent(reason)}`,
						302,
					)

				const channelId = new URL(request.url).searchParams
					.get("channelId")
					?.trim()
				if (!channelId) {
					return fail("missing_channel")
				}

				const session = await auth.api.getSession({ headers: request.headers })
				if (!session?.user) {
					return Response.redirect(`${origin}/?auth=login`, 302)
				}

				const channel = await getChannelForUser(session.user.id, channelId)
				if (!channel) {
					return fail("not_found")
				}

				const plan = (session.user.plan ?? "free") as MeResponse["plan"]
				const denial = getPublishingConnectionDenialReason(plan)
				if (denial) {
					return fail(denial)
				}

				if (!env.TIKTOK_OAUTH_STATE_SECRET) {
					return fail("tiktok_not_configured")
				}

				// PKCE — required by TikTok for all app types.
				const codeVerifier = randomBytes(32).toString("base64url")
				const codeChallenge = createHash("sha256")
					.update(codeVerifier)
					.digest("base64url")

				const state = signTiktokOAuthState(
					{
						u: session.user.id,
						c: channelId,
						cv: codeVerifier,
						exp: Date.now() + 15 * 60_000,
					},
					env.TIKTOK_OAUTH_STATE_SECRET,
				)

				// Use APP_PUBLIC_URL when set (local dev with tunnel / staging).
				// Falls back to request origin for production where origin is always correct.
				const baseUrl =
					env.ENVIRONMENT === "local"
						? "https://barstool-charcoal-battle.ngrok-free.dev"
						: (env.APP_PUBLIC_URL?.replace(/\/$/, "") ?? origin)
				const redirectUri = `${baseUrl}/api/tiktok/oauth/callback`
				const authorize = buildTiktokAuthorizeUrl({
					redirectUri,
					state,
					codeChallenge,
				})

				return Response.redirect(authorize, 302)
			},
		},
	},
})
