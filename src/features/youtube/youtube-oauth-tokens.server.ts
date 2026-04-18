import "@tanstack/react-start/server-only";

import { env } from "@/env";
import { logger } from "@/lib/logger";

/** Readonly to resolve channel; upload for future publish jobs. */
export const YOUTUBE_OAUTH_REQUESTED_SCOPES = [
	"https://www.googleapis.com/auth/youtube.readonly",
	"https://www.googleapis.com/auth/youtube.upload",
] as const;

const YOUTUBE_SCOPE_FULL = "https://www.googleapis.com/auth/youtube";

const YOUTUBE_SCOPES = YOUTUBE_OAUTH_REQUESTED_SCOPES.join(" ");

/**
 * Returns true if the granted scope string includes what we need: read access to
 * the channel (`youtube.readonly` or full `youtube`) and upload (`youtube.upload`
 * or full `youtube`). Users can uncheck individual scopes on the consent screen;
 * this detects partial grants.
 */
export function youtubeOAuthGrantsAllRequiredScopes(
	scopeHeader: string | undefined | null,
): boolean {
	if (!scopeHeader?.trim()) {
		return false;
	}
	const granted = new Set(
		scopeHeader
			.split(/\s+/)
			.map((s) => s.trim())
			.filter(Boolean),
	);
	if (granted.has(YOUTUBE_SCOPE_FULL)) {
		return true;
	}
	return (
		granted.has(YOUTUBE_OAUTH_REQUESTED_SCOPES[0]) &&
		granted.has(YOUTUBE_OAUTH_REQUESTED_SCOPES[1])
	);
}

/** If the token response omits `scope`, Google still exposes it via tokeninfo. */
async function fetchGrantedScopesFromTokeninfo(
	accessToken: string,
): Promise<string | undefined> {
	const url = new URL("https://oauth2.googleapis.com/tokeninfo");
	url.searchParams.set("access_token", accessToken);
	const res = await fetch(url.toString());
	if (!res.ok) {
		return undefined;
	}
	const data = (await res.json()) as { scope?: string };
	return data.scope;
}

export function buildGoogleYoutubeAuthorizeUrl(input: {
	redirectUri: string;
	state: string;
}): string {
	const p = new URLSearchParams({
		client_id: env.GOOGLE_CLIENT_ID,
		redirect_uri: input.redirectUri,
		response_type: "code",
		scope: YOUTUBE_SCOPES,
		access_type: "offline",
		prompt: "consent",
		state: input.state,
	});
	return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`;
}

export async function exchangeYoutubeAuthorizationCode(input: {
	code: string;
	redirectUri: string;
}): Promise<{
	access_token: string;
	refresh_token?: string;
	expires_in?: number;
	/** Space-separated scopes actually granted (may be a subset of the request). */
	scope?: string;
}> {
	const body = new URLSearchParams({
		code: input.code,
		client_id: env.GOOGLE_CLIENT_ID,
		client_secret: env.GOOGLE_CLIENT_SECRET,
		redirect_uri: input.redirectUri,
		grant_type: "authorization_code",
	});
	const res = await fetch("https://oauth2.googleapis.com/token", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body,
	});
	if (!res.ok) {
		const t = await res.text();
		logger.error("youtube_token_exchange_failed", { status: res.status, body: t.slice(0, 200) });
		throw new Error(`token_exchange_failed: ${res.status} ${t}`);
	}
	const tokens = await res.json() as {
		access_token: string;
		refresh_token?: string;
		expires_in?: number;
		scope?: string;
	};
	logger.info("youtube_token_exchange_ok", { hasRefreshToken: Boolean(tokens.refresh_token) });
	return tokens;
}

/**
 * Resolves granted scopes from the token exchange response, with tokeninfo
 * fallback when `scope` is omitted.
 */
export async function resolveYoutubeOAuthGrantedScopes(input: {
	accessToken: string;
	scopeFromTokenResponse?: string;
}): Promise<string | undefined> {
	const s = input.scopeFromTokenResponse?.trim();
	if (s) {
		return s;
	}
	return fetchGrantedScopesFromTokeninfo(input.accessToken);
}

/** Thrown when Google rejects the refresh token (revoked app access, password change, etc.). */
export class GoogleOAuthRefreshTokenInvalidError extends Error {
	override readonly name = "GoogleOAuthRefreshTokenInvalidError";
	constructor(message = "invalid_grant") {
		super(message);
		Object.setPrototypeOf(this, new.target.prototype);
	}
}

/**
 * Exchanges a stored refresh token for a short-lived access token. If the user
 * removed Klipse in Google Account settings, Google returns `invalid_grant` —
 * callers should clear the stored refresh token and prompt to reconnect.
 */
export async function refreshYoutubeAccessToken(refreshToken: string): Promise<{
	access_token: string;
	expires_in?: number;
	scope?: string;
}> {
	const body = new URLSearchParams({
		client_id: env.GOOGLE_CLIENT_ID,
		client_secret: env.GOOGLE_CLIENT_SECRET,
		refresh_token: refreshToken,
		grant_type: "refresh_token",
	});
	const res = await fetch("https://oauth2.googleapis.com/token", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body,
	});
	const json = (await res.json().catch(() => ({}))) as {
		access_token?: string;
		expires_in?: number;
		scope?: string;
		error?: string;
		error_description?: string;
	};
	if (!res.ok) {
		if (json.error === "invalid_grant") {
			logger.warn("youtube_refresh_token_invalid_grant", { error: json.error_description ?? json.error });
			throw new GoogleOAuthRefreshTokenInvalidError(
				json.error_description ?? json.error ?? "invalid_grant",
			);
		}
		logger.error("youtube_refresh_token_failed", { status: res.status, error: json.error });
		throw new Error(
			`refresh_token_exchange_failed: ${res.status} ${JSON.stringify(json)}`,
		);
	}
	if (!json.access_token) {
		throw new Error("refresh_token_exchange_missing_access_token");
	}
	logger.info("youtube_access_token_refreshed");
	return {
		access_token: json.access_token,
		expires_in: json.expires_in,
		scope: json.scope,
	};
}

function pickYoutubeThumbnailUrl(
	snippet: {
		thumbnails?: {
			high?: { url?: string };
			medium?: { url?: string };
			default?: { url?: string };
		};
	} | undefined,
): string | null {
	const t = snippet?.thumbnails;
	const u =
		t?.high?.url?.trim() ||
		t?.medium?.url?.trim() ||
		t?.default?.url?.trim();
	return u || null;
}

export async function fetchYoutubeMineChannel(accessToken: string): Promise<{
	id: string;
	title: string;
	customUrl: string | null;
	thumbnailUrl: string | null;
}> {
	const url = new URL("https://www.googleapis.com/youtube/v3/channels");
	url.searchParams.set("part", "snippet");
	url.searchParams.set("mine", "true");
	const res = await fetch(url.toString(), {
		headers: { Authorization: `Bearer ${accessToken}` },
	});
	if (!res.ok) {
		const t = await res.text();
		logger.error("youtube_fetch_channel_failed", { status: res.status, body: t.slice(0, 200) });
		throw new Error(`youtube_channels_failed: ${res.status} ${t}`);
	}
	const data = (await res.json()) as {
		items?: Array<{
			id: string;
			snippet?: {
				title?: string;
				customUrl?: string;
				thumbnails?: {
					high?: { url?: string };
					medium?: { url?: string };
					default?: { url?: string };
				};
			};
		}>;
	};
	const item = data.items?.[0];
	if (!item?.id) {
		throw new Error("youtube_no_channel");
	}
	const snippet = item.snippet;
	const channel = {
		id: item.id,
		title: snippet?.title ?? "",
		customUrl: snippet?.customUrl ?? null,
		thumbnailUrl: pickYoutubeThumbnailUrl(snippet),
	};
	logger.info("youtube_channel_fetched", { channelId: channel.id, title: channel.title });
	return channel;
}
