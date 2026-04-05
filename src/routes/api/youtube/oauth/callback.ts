import { createFileRoute } from "@tanstack/react-router";

import { env } from "@/env";

import { ChannelNotFoundError } from "@/features/channels/channel-errors";
import {
	getChannelForUser,
	userHasAnotherDestinationWithYoutubeChannelId,
} from "@/features/channels/channels.service.server";
import { applyYoutubeOAuthConnectionWithQuota } from "@/features/channels/destination-replacement-quota.server";
import {
	exchangeYoutubeAuthorizationCode,
	fetchYoutubeMineChannel,
	resolveYoutubeOAuthGrantedScopes,
	youtubeOAuthGrantsAllRequiredScopes,
} from "@/features/youtube/youtube-oauth-tokens.server";

import { auth } from "@/lib/auth";
import { verifyYoutubeOAuthState } from "@/lib/youtube-oauth-state.server";

function formatHandle(customUrl: string | null): string | null {
	if (!customUrl?.trim()) {
		return null;
	}
	const t = customUrl.trim();
	return t.startsWith("@") ? t : `@${t}`;
}

/**
 * Google redirects here with `code` + `state`. Exchanges tokens, loads YouTube
 * channel (`mine=true`), persists refresh token + metadata on the destination row.
 */
export const Route = createFileRoute("/api/youtube/oauth/callback")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const url = new URL(request.url);
				const origin = url.origin;
				const redirectBack = (path: string) =>
					Response.redirect(`${origin}${path}`, 302);

				const err = url.searchParams.get("error");
				const code = url.searchParams.get("code");
				const state = url.searchParams.get("state");

				if (err) {
					return redirectBack(
						`/dashboard/publishing?youtube=error&reason=${encodeURIComponent(err)}`,
					);
				}
				if (!code || !state) {
					return redirectBack(
						"/dashboard/publishing?youtube=error&reason=invalid",
					);
				}

				const payload = verifyYoutubeOAuthState(
					state,
					env.YOUTUBE_OAUTH_STATE_SECRET,
				);
				if (!payload) {
					return redirectBack(
						"/dashboard/publishing?youtube=error&reason=state",
					);
				}

				const session = await auth.api.getSession({ headers: request.headers });
				if (!session?.user || session.user.id !== payload.u) {
					return redirectBack(
						`/dashboard/publishing/${payload.c}?youtube=error&reason=session`,
					);
				}

				const redirectUri = `${origin}/api/youtube/oauth/callback`;

				try {
					const tokens = await exchangeYoutubeAuthorizationCode({
						code,
						redirectUri,
					});
					if (!tokens.refresh_token) {
						return redirectBack(
							`/dashboard/publishing/${payload.c}?youtube=error&reason=no_refresh`,
						);
					}

					const grantedScope = await resolveYoutubeOAuthGrantedScopes({
						accessToken: tokens.access_token,
						scopeFromTokenResponse: tokens.scope,
					});
					if (!youtubeOAuthGrantsAllRequiredScopes(grantedScope)) {
						return redirectBack(
							`/dashboard/publishing/${payload.c}?youtube=error&reason=${encodeURIComponent("youtube_scopes_incomplete")}`,
						);
					}

					const yt = await fetchYoutubeMineChannel(tokens.access_token);

					const destination = await getChannelForUser(
						session.user.id,
						payload.c,
					);
					if (!destination) {
						return redirectBack(
							`/dashboard/publishing/${payload.c}?youtube=error&reason=not_found`,
						);
					}

					const lockedChannelId =
						destination.boundYoutubeChannelId ?? destination.externalChannelId;
					if (lockedChannelId && lockedChannelId !== yt.id) {
						return redirectBack(
							`/dashboard/publishing/${payload.c}?youtube=error&reason=${encodeURIComponent("wrong_youtube_channel")}`,
						);
					}

					const duplicateElsewhere =
						await userHasAnotherDestinationWithYoutubeChannelId({
							userId: session.user.id,
							excludeChannelId: payload.c,
							youtubeChannelId: yt.id,
						});
					if (duplicateElsewhere) {
						return redirectBack(
							`/dashboard/publishing/${payload.c}?youtube=error&reason=${encodeURIComponent("youtube_channel_in_use")}`,
						);
					}

					const applied = await applyYoutubeOAuthConnectionWithQuota({
						userId: payload.u,
						channelId: payload.c,
						refreshToken: tokens.refresh_token,
						externalChannelId: yt.id,
						externalChannelTitle: yt.title || null,
						externalChannelHandle: formatHandle(yt.customUrl),
					});
					if (!applied.ok) {
						const reason =
							applied.code === "free_plan_blocked"
								? "youtube_requires_paid_plan"
								: "destination_replacements_exhausted";
						return redirectBack(
							`/dashboard/publishing/${payload.c}?youtube=error&reason=${encodeURIComponent(reason)}`,
						);
					}

					return redirectBack(
						`/dashboard/publishing/${payload.c}?youtube=connected`,
					);
				} catch (e) {
					if (e instanceof ChannelNotFoundError) {
						return redirectBack(
							`/dashboard/publishing/${payload.c}?youtube=error&reason=not_found`,
						);
					}
					console.error("[youtube-oauth]", e);
					return redirectBack(
						`/dashboard/publishing/${payload.c}?youtube=error&reason=exchange`,
					);
				}
			},
		},
	},
});
