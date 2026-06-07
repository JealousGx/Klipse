import "@tanstack/react-start/server-only"

import { and, eq } from "drizzle-orm"

import { getDb } from "@/db"
import type { LocalDb } from "@/db/local"
import { channels } from "@/db/schema/channels"
import { logger } from "@/lib/logger"

import { ChannelNotFoundError } from "./channel-errors"
import { getChannelForUser } from "./channels-core.service.server"

/** Server-only: read the stored platform OAuth refresh token for validation / refresh flows. */
export async function getOAuthRefreshTokenForChannel(
	userId: string,
	channelId: string,
): Promise<string | null> {
	const db = getDb()
	const rows = await db
		.select({ t: channels.oauthRefreshToken })
		.from(channels)
		.where(and(eq(channels.id, channelId), eq(channels.userId, userId)))
		.limit(1)
	const t = rows[0]?.t
	return t?.trim() ? t : null
}

/**
 * Clears only the stored OAuth refresh token (e.g. after the platform returns
 * an invalid_grant error). Keeps `boundExternalAccountId` and channel metadata
 * so the user can reconnect to the same account.
 */
export async function clearOAuthRefreshTokenOnly(input: {
	userId: string
	channelId: string
}): Promise<void> {
	const db = getDb()
	await db
		.update(channels)
		.set({
			oauthRefreshToken: null,
			updatedAt: new Date(),
		})
		.where(
			and(eq(channels.id, input.channelId), eq(channels.userId, input.userId)),
		)
	logger.warn("channel_oauth_token_cleared", {
		userId: input.userId,
		channelId: input.channelId,
	})
}

/**
 * Explicit user-initiated disconnect. Clears the OAuth refresh token and
 * external channel metadata, locks `boundExternalAccountId` so the user can
 * only reconnect with the same external account, but deliberately **preserves
 * `platform`** so the UI knows which reconnect button to show.
 */
export async function disconnectChannelOAuth(input: {
	userId: string
	channelId: string
}): Promise<void> {
	const db = getDb()

	const existing = await getChannelForUser(input.userId, input.channelId)
	if (!existing) {
		throw new ChannelNotFoundError()
	}

	const patch: Partial<typeof channels.$inferInsert> = {
		oauthRefreshToken: null,
		externalChannelId: null,
		externalChannelHandle: null,
		externalChannelThumbnailUrl: null,
		updatedAt: new Date(),
	}

	if (!existing.boundExternalAccountId && existing.externalChannelId) {
		patch.boundExternalAccountId = existing.externalChannelId.trim()
	}

	await db
		.update(channels)
		.set(patch)
		.where(
			and(eq(channels.id, input.channelId), eq(channels.userId, input.userId)),
		)

	logger.info("channel_oauth_disconnected", {
		userId: input.userId,
		channelId: input.channelId,
		platform: existing.platform,
	})
}

/**
 * Rotates a stored OAuth refresh token to a new value.
 * Used by platforms (e.g. TikTok) that issue a new refresh token on every
 * token-refresh call. The new token must be persisted before the old one
 * is consumed and discarded by the platform.
 */
export async function updateChannelOAuthRefreshToken(input: {
	userId: string
	channelId: string
	refreshToken: string
}): Promise<void> {
	const db = getDb()
	await db
		.update(channels)
		.set({
			oauthRefreshToken: input.refreshToken,
			updatedAt: new Date(),
		})
		.where(
			and(eq(channels.id, input.channelId), eq(channels.userId, input.userId)),
		)
	logger.info("channel_oauth_token_rotated", {
		userId: input.userId,
		channelId: input.channelId,
	})
}

export async function setChannelOAuthConnection(input: {
	userId: string
	channelId: string
	platform: "youtube" | "tiktok" | "instagram"
	refreshToken: string
	externalChannelId: string
	externalChannelTitle: string | null
	externalChannelHandle: string | null
	externalChannelThumbnailUrl: string | null
}): Promise<void> {
	const db = getDb()
	await setChannelOAuthConnectionTx(db, input)
}

/**
 * Same as {@link setChannelOAuthConnection} but uses the given executor (e.g.
 * transaction client) so it can run inside `FOR UPDATE` flows.
 */
export async function setChannelOAuthConnectionTx(
	tx: LocalDb,
	input: {
		userId: string
		channelId: string
		platform: "youtube" | "tiktok" | "instagram"
		refreshToken: string
		externalChannelId: string
		externalChannelTitle: string | null
		externalChannelHandle: string | null
		externalChannelThumbnailUrl: string | null
	},
): Promise<void> {
	const rows = await tx
		.select()
		.from(channels)
		.where(
			and(eq(channels.id, input.channelId), eq(channels.userId, input.userId)),
		)
		.limit(1)
	const existing = rows[0]
	if (!existing) {
		throw new ChannelNotFoundError()
	}
	const trimmedId = input.externalChannelId.trim()
	await tx
		.update(channels)
		.set({
			platform: input.platform,
			externalChannelId: trimmedId,
			externalChannelTitle: input.externalChannelTitle?.trim() || null,
			externalChannelHandle: input.externalChannelHandle?.trim() || null,
			externalChannelThumbnailUrl:
				input.externalChannelThumbnailUrl?.trim() || null,
			oauthRefreshToken: input.refreshToken,
			boundExternalAccountId: existing.boundExternalAccountId ?? trimmedId,
			updatedAt: new Date(),
		})
		.where(
			and(eq(channels.id, input.channelId), eq(channels.userId, input.userId)),
		)
	logger.info("channel_oauth_connected", {
		userId: input.userId,
		channelId: input.channelId,
		platform: input.platform,
		externalChannelId: trimmedId,
		externalChannelTitle: input.externalChannelTitle ?? null,
	})
}
