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
import { logger } from "@/lib/logger";

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
		logger.info("youtube_access_token_skipped_no_token", {
			userId: input.userId,
			channelId: input.channelId,
		});
		return { cleared: true };
	}
	try {
		const { access_token } = await refreshYoutubeAccessToken(token);
		logger.info("youtube_access_token_resolved", {
			userId: input.userId,
			channelId: input.channelId,
		});
		return { accessToken: access_token };
	} catch (e) {
		if (e instanceof GoogleOAuthRefreshTokenInvalidError) {
			logger.warn("youtube_oauth_token_revoked_clearing", {
				userId: input.userId,
				channelId: input.channelId,
			});
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
	// Only probe YouTube channels — other platforms store non-Google tokens.
	const channels = await listChannelsForUser(input.userId);
	const ch = channels.find((c) => c.id === input.channelId);
	if (!ch || ch.platform !== "youtube") {
		return "skipped";
	}
	const token = await getOAuthRefreshTokenForChannel(
		input.userId,
		input.channelId,
	);
	if (!token) {
		return "skipped";
	}
	try {
		await refreshYoutubeAccessToken(token);
		logger.info("youtube_oauth_reconcile_ok", {
			userId: input.userId,
			channelId: input.channelId,
		});
		return "ok";
	} catch (e) {
		if (e instanceof GoogleOAuthRefreshTokenInvalidError) {
			logger.warn("youtube_oauth_reconcile_revoked", {
				userId: input.userId,
				channelId: input.channelId,
			});
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
	const connected = list.filter(
		(ch) => ch.oauthConnected && ch.platform === "youtube",
	);
	logger.info("youtube_oauth_reconcile_start", {
		userId,
		totalChannels: list.length,
		connectedChannels: connected.length,
	});
	for (const ch of connected) {
		const r = await reconcileYoutubeOAuthForUserChannel({
			userId,
			channelId: ch.id,
		});
		if (r === "revoked") {
			revokedChannelIds.push(ch.id);
		}
	}
	logger.info("youtube_oauth_reconcile_complete", {
		userId,
		checked: connected.length,
		revoked: revokedChannelIds.length,
	});
	return { revokedChannelIds };
}
