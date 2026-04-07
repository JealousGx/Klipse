import "@tanstack/react-start/server-only";

import {
	clearOAuthRefreshTokenOnly,
	getOAuthRefreshTokenForChannel,
	listChannelsForUser,
} from "@/features/channels/channels.service.server";
import {
	GoogleOAuthRefreshTokenInvalidError,
	refreshYoutubeAccessToken,
} from "@/features/youtube/youtube-oauth-tokens.server";

/**
 * Use when a server job needs a YouTube access token. If Google rejected the
 * refresh token, clears it and returns `{ cleared: true }` so callers can skip
 * the job or surface “reconnect” state.
 */
export async function getYoutubeAccessTokenForChannelOrClear(input: {
	userId: string;
	channelId: string;
}): Promise<{ accessToken: string } | { cleared: true }> {
	const token = await getOAuthRefreshTokenForChannel(
		input.userId,
		input.channelId,
	);
	if (!token) {
		return { cleared: true };
	}
	try {
		const { access_token } = await refreshYoutubeAccessToken(token);
		return { accessToken: access_token };
	} catch (e) {
		if (e instanceof GoogleOAuthRefreshTokenInvalidError) {
			await clearOAuthRefreshTokenOnly({
				userId: input.userId,
				channelId: input.channelId,
			});
			return { cleared: true };
		}
		throw e;
	}
}

export async function reconcileYoutubeOAuthForUserChannel(input: {
	userId: string;
	channelId: string;
}): Promise<"ok" | "revoked" | "skipped"> {
	const token = await getOAuthRefreshTokenForChannel(
		input.userId,
		input.channelId,
	);
	if (!token) {
		return "skipped";
	}
	try {
		await refreshYoutubeAccessToken(token);
		return "ok";
	} catch (e) {
		if (e instanceof GoogleOAuthRefreshTokenInvalidError) {
			await clearOAuthRefreshTokenOnly({
				userId: input.userId,
				channelId: input.channelId,
			});
			return "revoked";
		}
		throw e;
	}
}

export async function reconcileAllYoutubeOAuthForUser(
	userId: string,
): Promise<{ revokedChannelIds: string[] }> {
	const list = await listChannelsForUser(userId);
	const revokedChannelIds: string[] = [];
	for (const ch of list) {
		if (!ch.oauthConnected) {
			continue;
		}
		const r = await reconcileYoutubeOAuthForUserChannel({
			userId,
			channelId: ch.id,
		});
		if (r === "revoked") {
			revokedChannelIds.push(ch.id);
		}
	}
	return { revokedChannelIds };
}
