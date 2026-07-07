import "@tanstack/react-start/server-only"

import { and, count, desc, eq, ne, or } from "drizzle-orm"

import { getDb } from "@/db"
import { channels } from "@/db/schema/channels"
import { users } from "@/db/schema/users"

import { assertChannelCapacity } from "@/features/entitlements"
import { upsertChannelSchedule } from "@/features/scheduling/scheduling.service.server"
import type { MeResponse } from "@/features/user/types/me"
import { channelRowId } from "@/lib/id"
import { logger } from "@/lib/logger"

import { type ChannelConfig, parseChannelConfig } from "./channel-config.schema"
import { ChannelNotFoundError } from "./channel-errors"

export type ChannelRow = {
	id: string
	userId: string
	name: string
	niche: string
	config: ChannelConfig
	platform: "unlinked" | "youtube" | "tiktok" | "instagram"
	externalChannelId: string | null
	externalChannelTitle: string | null
	externalChannelHandle: string | null
	/** Channel/profile image URL from the platform API. */
	externalChannelThumbnailUrl: string | null
	/** True when a platform OAuth refresh token is stored. Never includes the token. */
	oauthConnected: boolean
	/**
	 * External account id locked to this destination after first OAuth; reconnect must match.
	 * Null until first successful connect.
	 */
	boundExternalAccountId: string | null
	createdAt: Date
	updatedAt: Date
}

export function toChannelRow(r: typeof channels.$inferSelect): ChannelRow {
	return {
		id: r.id,
		userId: r.userId,
		name: r.name,
		niche: r.niche,
		config: parseChannelConfig(r.config),
		platform: r.platform,
		externalChannelId: r.externalChannelId ?? null,
		externalChannelTitle: r.externalChannelTitle ?? null,
		externalChannelHandle: r.externalChannelHandle ?? null,
		externalChannelThumbnailUrl: r.externalChannelThumbnailUrl ?? null,
		oauthConnected: Boolean(r.oauthRefreshToken),
		boundExternalAccountId: r.boundExternalAccountId ?? null,
		createdAt: r.createdAt,
		updatedAt: r.updatedAt,
	}
}

/**
 * Dev-only: if the user has no destinations, inserts a default row so Generate/Jobs
 * can be exercised locally without onboarding. **No-op in production builds** (`import.meta.env.PROD`);
 * production users get destinations from real onboarding / explicit creation.
 */
export async function ensureDefaultPublishingDestination(
	userId: string,
): Promise<void> {
	if (!import.meta.env.DEV) {
		return
	}

	const db = getDb()
	const [countRow] = await db
		.select({ c: count() })
		.from(channels)
		.where(eq(channels.userId, userId))

	if (Number(countRow?.c ?? 0) > 0) {
		return
	}

	await createChannel({
		userId,
		name: "Primary publishing destination",
		niche:
			"Link a social account to publish finished videos automatically. YouTube is first; additional platforms use the same destination model.",
	})
}

export async function listChannelsForUser(
	userId: string,
): Promise<ChannelRow[]> {
	const db = getDb()
	const rows = await db
		.select()
		.from(channels)
		.where(eq(channels.userId, userId))
		.orderBy(desc(channels.createdAt))

	return rows.map((r) => toChannelRow(r))
}

export async function getChannelForUser(
	userId: string,
	channelId: string,
): Promise<ChannelRow | null> {
	const db = getDb()
	const rows = await db
		.select()
		.from(channels)
		.where(and(eq(channels.id, channelId), eq(channels.userId, userId)))
		.limit(1)
	const r = rows[0]
	if (!r) {
		return null
	}
	return toChannelRow(r)
}

/**
 * True if another publishing destination for this user already uses this external
 * account id (bound and/or external column), excluding `excludeChannelId`.
 */
export async function userHasAnotherDestinationWithExternalChannelId(input: {
	userId: string
	excludeChannelId: string
	externalChannelId: string
}): Promise<boolean> {
	const db = getDb()
	const yt = input.externalChannelId.trim()
	if (!yt) {
		return false
	}
	const rows = await db
		.select({ id: channels.id })
		.from(channels)
		.where(
			and(
				eq(channels.userId, input.userId),
				ne(channels.id, input.excludeChannelId),
				or(
					eq(channels.boundExternalAccountId, yt),
					eq(channels.externalChannelId, yt),
				),
			),
		)
		.limit(1)
	return rows.length > 0
}

export async function createChannel(input: {
	userId: string
	name: string
	niche: string
	config?: unknown
}): Promise<ChannelRow> {
	const db = getDb()

	const [u] = await db
		.select({ plan: users.plan })
		.from(users)
		.where(eq(users.id, input.userId))
		.limit(1)
	if (!u) {
		throw new Error("User not found.")
	}

	const plan = u.plan as MeResponse["plan"]

	const [countRow] = await db
		.select({ c: count() })
		.from(channels)
		.where(eq(channels.userId, input.userId))

	assertChannelCapacity({
		plan,
		currentChannelCount: Number(countRow?.c ?? 0),
	})

	const config = parseChannelConfig(input.config ?? {})

	const id = channelRowId()
	const now = new Date()

	await db.insert(channels).values({
		id,
		userId: input.userId,
		name: input.name.trim(),
		niche: input.niche.trim(),
		config,
		platform: "unlinked",
		externalChannelId: null,
		externalChannelTitle: null,
		externalChannelHandle: null,
		externalChannelThumbnailUrl: null,
		oauthRefreshToken: null,
		boundExternalAccountId: null,
		createdAt: now,
		updatedAt: now,
	})

	const created = await getChannelForUser(input.userId, id)
	if (!created) {
		throw new Error("Channel insert failed.")
	}

	await upsertChannelSchedule({
		userId: input.userId,
		channelId: created.id,
		frequency: config.posting_frequency,
	})

	logger.info("channel_created", {
		userId: input.userId,
		channelId: created.id,
		platform: "unlinked",
		plan,
	})

	return created
}

export async function updateChannel(input: {
	userId: string
	channelId: string
	name?: string
	niche?: string
	config?: unknown
	platform?: "unlinked" | "youtube" | "tiktok" | "instagram"
	externalChannelId?: string | null
	externalChannelTitle?: string | null
	externalChannelHandle?: string | null
	externalChannelThumbnailUrl?: string | null
}): Promise<ChannelRow> {
	const db = getDb()
	const existing = await getChannelForUser(input.userId, input.channelId)
	if (!existing) {
		throw new ChannelNotFoundError()
	}

	const patch: Partial<typeof channels.$inferInsert> = {
		updatedAt: new Date(),
	}
	if (input.name !== undefined) patch.name = input.name.trim()
	if (input.niche !== undefined) patch.niche = input.niche.trim()
	if (input.config !== undefined)
		patch.config = parseChannelConfig(input.config)
	if (input.platform !== undefined) patch.platform = input.platform
	if (input.externalChannelId !== undefined) {
		const raw = input.externalChannelId
		const cleared = raw === null || raw === ""
		patch.externalChannelId = cleared ? null : raw.trim()
		if (cleared) patch.externalChannelThumbnailUrl = null
	}
	if (input.externalChannelTitle !== undefined) {
		patch.externalChannelTitle =
			input.externalChannelTitle === null || input.externalChannelTitle === ""
				? null
				: input.externalChannelTitle.trim()
	}
	if (input.externalChannelHandle !== undefined) {
		patch.externalChannelHandle =
			input.externalChannelHandle === null || input.externalChannelHandle === ""
				? null
				: input.externalChannelHandle.trim()
	}
	if (input.externalChannelThumbnailUrl !== undefined) {
		patch.externalChannelThumbnailUrl =
			input.externalChannelThumbnailUrl === null ||
			input.externalChannelThumbnailUrl === ""
				? null
				: input.externalChannelThumbnailUrl.trim()
	}
	if (input.platform === "unlinked") {
		patch.oauthRefreshToken = null
		if (!existing.boundExternalAccountId && existing.externalChannelId) {
			patch.boundExternalAccountId = existing.externalChannelId.trim()
		}
	}

	await db
		.update(channels)
		.set(patch)
		.where(
			and(eq(channels.id, input.channelId), eq(channels.userId, input.userId)),
		)

	const next = await getChannelForUser(input.userId, input.channelId)
	if (!next) {
		throw new ChannelNotFoundError()
	}

	if (
		input.config !== undefined &&
		next.config.posting_frequency !== existing.config.posting_frequency
	) {
		await upsertChannelSchedule({
			userId: input.userId,
			channelId: next.id,
			frequency: next.config.posting_frequency,
		})
	}

	logger.info("channel_updated", {
		userId: input.userId,
		channelId: input.channelId,
		platform: next.platform,
		oauthConnected: next.oauthConnected,
	})

	return next
}

export async function deleteChannel(input: {
	userId: string
	channelId: string
}): Promise<void> {
	const existing = await getChannelForUser(input.userId, input.channelId)
	if (!existing) {
		throw new ChannelNotFoundError()
	}
	const db = getDb()
	await db
		.delete(channels)
		.where(
			and(eq(channels.id, input.channelId), eq(channels.userId, input.userId)),
		)
	logger.info("channel_deleted", {
		userId: input.userId,
		channelId: input.channelId,
		platform: existing.platform,
		oauthConnected: existing.oauthConnected,
	})
}
