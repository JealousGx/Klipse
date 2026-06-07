import "@tanstack/react-start/server-only"

import { env } from "@/env"
import { logger } from "@/lib/logger"

export const TIKTOK_OAUTH_REQUESTED_SCOPES = [
	"user.info.basic",
	"video.publish",
] as const

const TIKTOK_SCOPES = TIKTOK_OAUTH_REQUESTED_SCOPES.join(",")

const TIKTOK_AUTH_BASE = "https://www.tiktok.com"
const TIKTOK_API_BASE = "https://open.tiktokapis.com"

/**
 * Returns true if the granted scope string includes all required scopes.
 * TikTok returns comma-separated scopes; users can deny individual permissions.
 */
export function tiktokOAuthGrantsAllRequiredScopes(
	scopeHeader: string | undefined | null,
): boolean {
	if (!scopeHeader?.trim()) return false
	const granted = new Set(
		scopeHeader
			.split(/[,\s]+/)
			.map((s) => s.trim())
			.filter(Boolean),
	)
	return TIKTOK_OAUTH_REQUESTED_SCOPES.every((s) => granted.has(s))
}

function requireTiktokEnv(): { clientKey: string; clientSecret: string } {
	const clientKey = env.TIKTOK_CLIENT_KEY
	const clientSecret = env.TIKTOK_CLIENT_SECRET
	if (!clientKey || !clientSecret) {
		throw new Error(
			"tiktok_not_configured: TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET must be set",
		)
	}
	return { clientKey, clientSecret }
}

export function buildTiktokAuthorizeUrl(input: {
	redirectUri: string
	state: string
	codeChallenge: string
}): string {
	const { clientKey } = requireTiktokEnv()
	const p = new URLSearchParams({
		client_key: clientKey,
		redirect_uri: input.redirectUri,
		response_type: "code",
		scope: TIKTOK_SCOPES,
		state: input.state,
		code_challenge: input.codeChallenge,
		code_challenge_method: "S256",
	})
	return `${TIKTOK_AUTH_BASE}/v2/auth/authorize/?${p.toString()}`
}

export async function exchangeTiktokAuthorizationCode(input: {
	code: string
	redirectUri: string
	codeVerifier: string
}): Promise<{
	access_token: string
	refresh_token: string
	open_id: string
	expires_in: number
	refresh_expires_in?: number
	scope?: string
}> {
	const { clientKey, clientSecret } = requireTiktokEnv()
	const body = new URLSearchParams({
		client_key: clientKey,
		client_secret: clientSecret,
		code: input.code,
		grant_type: "authorization_code",
		redirect_uri: input.redirectUri,
		code_verifier: input.codeVerifier,
	})
	const res = await fetch(`${TIKTOK_API_BASE}/v2/oauth/token/`, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body,
	})
	if (!res.ok) {
		const t = await res.text()
		logger.error("tiktok_token_exchange_failed", {
			status: res.status,
			body: t.slice(0, 200),
		})
		throw new Error(`tiktok_token_exchange_failed: ${res.status} ${t}`)
	}
	const json = (await res.json()) as {
		access_token?: string
		refresh_token?: string
		open_id?: string
		expires_in?: number
		refresh_expires_in?: number
		scope?: string
		error?: string
		error_description?: string
	}
	if (
		json.error ||
		!json.access_token ||
		!json.refresh_token ||
		!json.open_id
	) {
		logger.error("tiktok_token_exchange_invalid_response", {
			error: json.error,
			hasAccessToken: Boolean(json.access_token),
			hasRefreshToken: Boolean(json.refresh_token),
			hasOpenId: Boolean(json.open_id),
		})
		throw new Error(
			`tiktok_token_exchange_invalid_response: ${json.error ?? "missing_fields"}`,
		)
	}
	logger.info("tiktok_token_exchange_ok", { openId: json.open_id })
	return {
		access_token: json.access_token,
		refresh_token: json.refresh_token,
		open_id: json.open_id,
		expires_in: json.expires_in ?? 86400,
		refresh_expires_in: json.refresh_expires_in,
		scope: json.scope,
	}
}

export type TiktokCreatorInfo = {
	creatorUsername: string
	creatorNickname: string
	/** Avatar URL has a 2-hour TTL — suitable for display at connect time only. */
	creatorAvatarUrl: string | null
	privacyLevelOptions: string[]
	commentDisabled: boolean
	duetDisabled: boolean
	stitchDisabled: boolean
	maxVideoPostDurationSec: number
}

/**
 * Fetches the creator's profile and posting settings via the Content Posting API.
 * Required before every video post to get valid `privacy_level_options`.
 */
export async function fetchTiktokCreatorInfo(
	accessToken: string,
): Promise<TiktokCreatorInfo> {
	const res = await fetch(
		`${TIKTOK_API_BASE}/v2/post/publish/creator_info/query/`,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json; charset=UTF-8",
			},
			body: JSON.stringify({}),
		},
	)
	if (!res.ok) {
		const t = await res.text()
		logger.error("tiktok_creator_info_failed", {
			status: res.status,
			body: t.slice(0, 200),
		})
		throw new Error(`tiktok_creator_info_failed: ${res.status} ${t}`)
	}
	const json = (await res.json()) as {
		data?: {
			creator_avatar_url?: string
			creator_username?: string
			creator_nickname?: string
			privacy_level_options?: string[]
			comment_disabled?: boolean
			duet_disabled?: boolean
			stitch_disabled?: boolean
			max_video_post_duration_sec?: number
		}
		error?: { code?: string; message?: string }
	}
	if (json.error?.code && json.error.code !== "ok") {
		const code = json.error.code
		// Daily post cap reached — caller should surface "try again later".
		if (
			code === "spam_risk_too_many_posts" ||
			code === "reached_active_user_cap"
		) {
			logger.warn("tiktok_creator_post_cap_reached", { code })
			throw new TiktokPostCapReachedError(code)
		}
		logger.error("tiktok_creator_info_api_error", {
			code,
			message: json.error.message,
		})
		throw new Error(`tiktok_creator_info_api_error: ${code}`)
	}
	const d = json.data ?? {}
	logger.info("tiktok_creator_info_fetched", {
		username: d.creator_username,
		privacyOptions: d.privacy_level_options,
	})
	return {
		creatorUsername: d.creator_username?.trim() ?? "",
		creatorNickname: d.creator_nickname?.trim() ?? "",
		creatorAvatarUrl: d.creator_avatar_url?.trim() || null,
		privacyLevelOptions: d.privacy_level_options ?? [],
		commentDisabled: d.comment_disabled ?? false,
		duetDisabled: d.duet_disabled ?? false,
		stitchDisabled: d.stitch_disabled ?? false,
		maxVideoPostDurationSec: d.max_video_post_duration_sec ?? 600,
	}
}

/** Thrown when TikTok rejects the refresh token (revoked, expired after 365d, etc.). */
export class TiktokOAuthRefreshTokenInvalidError extends Error {
	override readonly name = "TiktokOAuthRefreshTokenInvalidError"
	constructor(message = "tiktok_invalid_grant") {
		super(message)
		Object.setPrototypeOf(this, new.target.prototype)
	}
}

/**
 * Thrown when TikTok reports the creator has hit their daily post cap.
 * Error codes: `spam_risk_too_many_posts`, `reached_active_user_cap`.
 */
export class TiktokPostCapReachedError extends Error {
	override readonly name = "TiktokPostCapReachedError"
	constructor(code = "spam_risk_too_many_posts") {
		super(`tiktok_post_cap_reached: ${code}`)
		Object.setPrototypeOf(this, new.target.prototype)
	}
}

/**
 * Exchanges a stored refresh token for a new access token.
 *
 * IMPORTANT: TikTok rotates refresh tokens on every refresh call.
 * The caller MUST persist `newRefreshToken` back to the DB immediately.
 */
export async function refreshTiktokAccessToken(refreshToken: string): Promise<{
	access_token: string
	/** New refresh token — MUST be saved to DB, replaces the old one. */
	new_refresh_token: string
	expires_in: number
}> {
	const { clientKey, clientSecret } = requireTiktokEnv()
	const body = new URLSearchParams({
		client_key: clientKey,
		client_secret: clientSecret,
		grant_type: "refresh_token",
		refresh_token: refreshToken,
	})
	const res = await fetch(`${TIKTOK_API_BASE}/v2/oauth/token/`, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body,
	})
	const json = (await res.json().catch(() => ({}))) as {
		access_token?: string
		refresh_token?: string
		expires_in?: number
		error?: string
		error_description?: string
	}
	if (!res.ok) {
		logger.warn("tiktok_refresh_token_failed", {
			status: res.status,
			error: json.error,
			description: json.error_description,
		})
		// Any non-ok response from the refresh endpoint means token is dead.
		throw new TiktokOAuthRefreshTokenInvalidError(
			json.error_description ?? json.error ?? "tiktok_refresh_failed",
		)
	}
	if (!json.access_token || !json.refresh_token) {
		throw new TiktokOAuthRefreshTokenInvalidError(
			"tiktok_refresh_missing_tokens",
		)
	}
	logger.info("tiktok_access_token_refreshed")
	return {
		access_token: json.access_token,
		new_refresh_token: json.refresh_token,
		expires_in: json.expires_in ?? 86400,
	}
}
