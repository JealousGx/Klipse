import { createFileRoute } from "@tanstack/react-router";

import { env } from "@/env";

import { planAllowsPaidPublishingConnections } from "@/features/billing/tier-config";
import { getChannelForUser } from "@/features/channels/channels.service.server";
import type { MeResponse } from "@/features/user/types/me";
import { buildGoogleYoutubeAuthorizeUrl } from "@/features/youtube/youtube-oauth-tokens.server";

import { auth } from "@/lib/auth";
import { signYoutubeOAuthState } from "@/lib/youtube-oauth-state.server";

/**
 * Starts Google OAuth for YouTube (readonly + upload scopes). Requires session.
 * Query: `channelId` = Klipse publishing destination id.
 */
export const Route = createFileRoute("/api/youtube/oauth/start")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const origin = new URL(request.url).origin;
				const fail = (reason: string) =>
					Response.redirect(
						`${origin}/dashboard/publishing?youtube=error&reason=${encodeURIComponent(reason)}`,
						302,
					);

				const channelId = new URL(request.url).searchParams
					.get("channelId")
					?.trim();
				if (!channelId) {
					return fail("missing_channel");
				}

				const session = await auth.api.getSession({ headers: request.headers });
				if (!session?.user) {
					return Response.redirect(`${origin}/?auth=login`, 302);
				}

				const channel = await getChannelForUser(session.user.id, channelId);
				if (!channel) {
					return fail("not_found");
				}

				const plan = (session.user.plan ?? "free") as MeResponse["plan"];
				if (!planAllowsPaidPublishingConnections(plan)) {
					return fail("youtube_requires_paid_plan");
				}

				const state = signYoutubeOAuthState(
					{
						u: session.user.id,
						c: channelId,
						exp: Date.now() + 15 * 60_000,
					},
					env.YOUTUBE_OAUTH_STATE_SECRET,
				);

				const redirectUri = `${origin}/api/youtube/oauth/callback`;
				const authorize = buildGoogleYoutubeAuthorizeUrl({
					redirectUri,
					state,
				});

				return Response.redirect(authorize, 302);
			},
		},
	},
});
