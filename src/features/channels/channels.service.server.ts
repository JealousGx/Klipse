import "@tanstack/react-start/server-only";

import { and, count, desc, eq, ne, or } from "drizzle-orm";

import { getDb } from "@/db";
import type { LocalDb } from "@/db/local";
import { channels } from "@/db/schema/channels";
import { users } from "@/db/schema/users";

import { assertChannelCapacity } from "@/features/entitlements";
import type { MeResponse } from "@/features/user/types/me";

import { channelRowId } from "@/lib/id";
import { logger } from "@/lib/logger";

import { upsertChannelSchedule } from "@/features/scheduling/scheduling.service.server";

import {
	type ChannelConfig,
	parseChannelConfig,
} from "./channel-config.schema";
import { ChannelNotFoundError } from "./channel-errors";

export { ChannelLimitError, ChannelNotFoundError } from "./channel-errors";

export type ChannelRow = {
	id: string;
	userId: string;
	name: string;
	niche: string;
	config: ChannelConfig;
	platform: "unlinked" | "youtube" | "tiktok" | "instagram";
	externalChannelId: string | null;
	externalChannelTitle: string | null;
	externalChannelHandle: string | null;
	/** Channel/profile image URL from the platform API. */
	externalChannelThumbnailUrl: string | null;
	/** True when a platform OAuth refresh token is stored. Never includes the token. */
	oauthConnected: boolean;
	/**
	 * External account id locked to this destination after first OAuth; reconnect must match.
	 * Null until first successful connect.
	 */
	boundExternalAccountId: string | null;
	/** Whether to generate AI background sound for videos (Creator+ only). */
	soundEnabled: boolean;
	/** Optional prompt hint for sound generation; null = auto-generate from channel brief. */
	soundPromptHint: string | null;
	createdAt: Date;
	updatedAt: Date;
};

function toChannelRow(r: typeof channels.$inferSelect): ChannelRow {
	return {
		id: r.id,
		userId: r.userId,
		name: r.name,
		niche: r.niche,
		config: parseConfig(r.config),
		platform: r.platform,
		externalChannelId: r.externalChannelId ?? null,
		externalChannelTitle: r.externalChannelTitle ?? null,
		externalChannelHandle: r.externalChannelHandle ?? null,
		externalChannelThumbnailUrl: r.externalChannelThumbnailUrl ?? null,
		oauthConnected: Boolean(r.oauthRefreshToken),
		boundExternalAccountId: r.boundExternalAccountId ?? null,
		soundEnabled: r.soundEnabled ?? true,
		soundPromptHint: r.soundPromptHint ?? null,
		createdAt: r.createdAt,
		updatedAt: r.updatedAt,
	};
}

function parseConfig(raw: unknown): ChannelConfig {
	return parseChannelConfig(raw);
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
		return;
	}

	const db = getDb();
	const [countRow] = await db
		.select({ c: count() })
		.from(channels)
		.where(eq(channels.userId, userId));

	if (Number(countRow?.c ?? 0) > 0) {
		return;
	}

	await createChannel({
		userId,
		name: "Primary publishing destination",
		niche:
			"Link a social account to publish finished videos automatically. YouTube is first; additional platforms use the same destination model.",
	});
}

export async function listChannelsForUser(
	userId: string,
): Promise<ChannelRow[]> {
	const db = getDb();
	const rows = await db
		.select()
		.from(channels)
		.where(eq(channels.userId, userId))
		.orderBy(desc(channels.createdAt));

	return rows.map((r) => toChannelRow(r));
}

export async function getChannelForUser(
	userId: string,
	channelId: string,
): Promise<ChannelRow | null> {
	const db = getDb();
	const rows = await db
		.select()
		.from(channels)
		.where(and(eq(channels.id, channelId), eq(channels.userId, userId)))
		.limit(1);
	const r = rows[0];
	if (!r) {
		return null;
	}
	return toChannelRow(r);
}

/**
 * True if another publishing destination for this user already uses this external
 * account id (bound and/or external column), excluding `excludeChannelId`.
 */
export async function userHasAnotherDestinationWithExternalChannelId(input: {
	userId: string;
	excludeChannelId: string;
	externalChannelId: string;
}): Promise<boolean> {
	const db = getDb();
	const yt = input.externalChannelId.trim();
	if (!yt) {
		return false;
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
		.limit(1);
	return rows.length > 0;
}

export async function createChannel(input: {
	userId: string;
	name: string;
	niche: string;
	config?: unknown;
}): Promise<ChannelRow> {
	const db = getDb();

	const [u] = await db
		.select({ plan: users.plan })
		.from(users)
		.where(eq(users.id, input.userId))
		.limit(1);
	if (!u) {
		throw new Error("User not found.");
	}

	const plan = u.plan as MeResponse["plan"];

	const [countRow] = await db
		.select({ c: count() })
		.from(channels)
		.where(eq(channels.userId, input.userId));

	assertChannelCapacity({
		plan,
		currentChannelCount: Number(countRow?.c ?? 0),
	});

	const config = parseChannelConfig(input.config ?? {});

	const id = channelRowId();
	const now = new Date();

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
	});

	const created = await getChannelForUser(input.userId, id);
	if (!created) {
		throw new Error("Channel insert failed.");
	}

	await upsertChannelSchedule({
		userId: input.userId,
		channelId: created.id,
		frequency: config.posting_frequency,
	});

	logger.info("channel_created", {
		userId: input.userId,
		channelId: created.id,
		platform: "unlinked",
		plan,
	});

	return created;
}

export async function updateChannel(input: {
	userId: string;
	channelId: string;
	name?: string;
	niche?: string;
	config?: unknown;
	platform?: "unlinked" | "youtube" | "tiktok" | "instagram";
	/** YouTube: `UC…` channel id from the platform (not Klipse’s row id). */
	externalChannelId?: string | null;
	externalChannelTitle?: string | null;
	externalChannelHandle?: string | null;
	externalChannelThumbnailUrl?: string | null;
	soundEnabled?: boolean;
	soundPromptHint?: string | null;
}): Promise<ChannelRow> {
	const db = getDb();
	const existing = await getChannelForUser(input.userId, input.channelId);
	if (!existing) {
		throw new ChannelNotFoundError();
	}

	const patch: Partial<typeof channels.$inferInsert> = {
		updatedAt: new Date(),
	};
	if (input.name !== undefined) {
		patch.name = input.name.trim();
	}
	if (input.niche !== undefined) {
		patch.niche = input.niche.trim();
	}
	if (input.config !== undefined) {
		patch.config = parseChannelConfig(input.config);
	}
	if (input.platform !== undefined) {
		patch.platform = input.platform;
	}
	if (input.externalChannelId !== undefined) {
		const raw = input.externalChannelId;
		const cleared = raw === null || raw === "";
		patch.externalChannelId = cleared ? null : raw.trim();
		if (cleared) {
			patch.externalChannelThumbnailUrl = null;
		}
	}
	if (input.externalChannelTitle !== undefined) {
		patch.externalChannelTitle =
			input.externalChannelTitle === null || input.externalChannelTitle === ""
				? null
				: input.externalChannelTitle.trim();
	}
	if (input.externalChannelHandle !== undefined) {
		patch.externalChannelHandle =
			input.externalChannelHandle === null || input.externalChannelHandle === ""
				? null
				: input.externalChannelHandle.trim();
	}
	if (input.externalChannelThumbnailUrl !== undefined) {
		patch.externalChannelThumbnailUrl =
			input.externalChannelThumbnailUrl === null ||
			input.externalChannelThumbnailUrl === ""
				? null
				: input.externalChannelThumbnailUrl.trim();
	}
	if (input.platform === "unlinked") {
		patch.oauthRefreshToken = null;
		if (!existing.boundExternalAccountId && existing.externalChannelId) {
			patch.boundExternalAccountId = existing.externalChannelId.trim();
		}
	}
	if (input.soundEnabled !== undefined) {
		patch.soundEnabled = input.soundEnabled;
	}
	if (input.soundPromptHint !== undefined) {
		patch.soundPromptHint =
			input.soundPromptHint === null || input.soundPromptHint === ""
				? null
				: input.soundPromptHint.trim();
	}

	await db
		.update(channels)
		.set(patch)
		.where(
			and(eq(channels.id, input.channelId), eq(channels.userId, input.userId)),
		);

	const next = await getChannelForUser(input.userId, input.channelId);
	if (!next) {
		throw new ChannelNotFoundError();
	}

	// Sync schedule when posting_frequency changes (or create one if it doesn't exist yet).
	if (
		input.config !== undefined &&
		next.config.posting_frequency !== existing.config.posting_frequency
	) {
		await upsertChannelSchedule({
			userId: input.userId,
			channelId: next.id,
			frequency: next.config.posting_frequency,
		});
	}

	logger.info("channel_updated", {
		userId: input.userId,
		channelId: input.channelId,
		platform: next.platform,
		oauthConnected: next.oauthConnected,
	});

	return next;
}

/** Server-only: read the stored platform OAuth refresh token for validation / refresh flows. */
export async function getOAuthRefreshTokenForChannel(
	userId: string,
	channelId: string,
): Promise<string | null> {
	const db = getDb();
	const rows = await db
		.select({ t: channels.oauthRefreshToken })
		.from(channels)
		.where(and(eq(channels.id, channelId), eq(channels.userId, userId)))
		.limit(1);
	const t = rows[0]?.t;
	return t?.trim() ? t : null;
}

/**
 * Clears only the stored OAuth refresh token (e.g. after the platform returns
 * an invalid_grant error). Keeps `boundExternalAccountId` and channel metadata
 * so the user can reconnect to the same account.
 */
export async function clearOAuthRefreshTokenOnly(input: {
	userId: string;
	channelId: string;
}): Promise<void> {
	const db = getDb();
	await db
		.update(channels)
		.set({
			oauthRefreshToken: null,
			updatedAt: new Date(),
		})
		.where(
			and(eq(channels.id, input.channelId), eq(channels.userId, input.userId)),
		);
	logger.warn("channel_oauth_token_cleared", {
		userId: input.userId,
		channelId: input.channelId,
	});
}

export async function setChannelOAuthConnection(input: {
	userId: string;
	channelId: string;
	platform: "youtube" | "tiktok" | "instagram";
	refreshToken: string;
	externalChannelId: string;
	externalChannelTitle: string | null;
	externalChannelHandle: string | null;
	externalChannelThumbnailUrl: string | null;
}): Promise<void> {
	const db = getDb();
	await setChannelOAuthConnectionTx(db, input);
}

/**
 * Same as {@link setChannelOAuthConnection} but uses the given executor (e.g.
 * transaction client) so it can run inside `FOR UPDATE` flows.
 */
export async function setChannelOAuthConnectionTx(
	tx: LocalDb,
	input: {
		userId: string;
		channelId: string;
		platform: "youtube" | "tiktok" | "instagram";
		refreshToken: string;
		externalChannelId: string;
		externalChannelTitle: string | null;
		externalChannelHandle: string | null;
		externalChannelThumbnailUrl: string | null;
	},
): Promise<void> {
	const rows = await tx
		.select()
		.from(channels)
		.where(
			and(eq(channels.id, input.channelId), eq(channels.userId, input.userId)),
		)
		.limit(1);
	const existing = rows[0];
	if (!existing) {
		throw new ChannelNotFoundError();
	}
	const trimmedId = input.externalChannelId.trim();
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
		);
	logger.info("channel_oauth_connected", {
		userId: input.userId,
		channelId: input.channelId,
		platform: input.platform,
		externalChannelId: trimmedId,
		externalChannelTitle: input.externalChannelTitle ?? null,
	});
}

export async function deleteChannel(input: {
	userId: string;
	channelId: string;
}): Promise<void> {
	const existing = await getChannelForUser(input.userId, input.channelId);
	if (!existing) {
		throw new ChannelNotFoundError();
	}
	const db = getDb();
	await db
		.delete(channels)
		.where(
			and(eq(channels.id, input.channelId), eq(channels.userId, input.userId)),
		);
	logger.info("channel_deleted", {
		userId: input.userId,
		channelId: input.channelId,
		platform: existing.platform,
		oauthConnected: existing.oauthConnected,
	});
}
