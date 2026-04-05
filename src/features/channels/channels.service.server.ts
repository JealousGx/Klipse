import "@tanstack/react-start/server-only";

import { and, count, desc, eq, ne, or } from "drizzle-orm";

import { getDb } from "@/db";
import type { LocalDb } from "@/db/local";
import { channels } from "@/db/schema/channels";
import { users } from "@/db/schema/users";

import { MAX_CHANNELS_BY_PLAN } from "@/features/billing/tier-config";
import type { MeResponse } from "@/features/user/types/me";

import { channelRowId } from "@/lib/id";

import {
	type ChannelConfig,
	channelConfigSchema,
	defaultChannelConfig,
} from "./channel-config.schema";
import { ChannelLimitError, ChannelNotFoundError } from "./channel-errors";

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
	/** Channel/profile image URL from the platform (e.g. YouTube). */
	externalChannelThumbnailUrl: string | null;
	/** True when a YouTube refresh token is stored (OAuth connect). Never includes the token. */
	youtubeConnected: boolean;
	/**
	 * YouTube `UC…` id locked to this destination after first OAuth; reconnect must match.
	 * Null until first successful connect.
	 */
	boundYoutubeChannelId: string | null;
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
		youtubeConnected: Boolean(r.youtubeRefreshToken),
		boundYoutubeChannelId: r.boundYoutubeChannelId ?? null,
		createdAt: r.createdAt,
		updatedAt: r.updatedAt,
	};
}

function parseConfig(raw: unknown): ChannelConfig {
	const parsed = channelConfigSchema.safeParse(raw);
	return parsed.success ? parsed.data : defaultChannelConfig();
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
 * True if another publishing destination for this user already uses this YouTube
 * `UC…` id (bound and/or external column), excluding `excludeChannelId`.
 */
export async function userHasAnotherDestinationWithYoutubeChannelId(input: {
	userId: string;
	excludeChannelId: string;
	youtubeChannelId: string;
}): Promise<boolean> {
	const db = getDb();
	const yt = input.youtubeChannelId.trim();
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
					eq(channels.boundYoutubeChannelId, yt),
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
	const max = MAX_CHANNELS_BY_PLAN[plan];

	const [countRow] = await db
		.select({ c: count() })
		.from(channels)
		.where(eq(channels.userId, input.userId));

	if (Number(countRow?.c ?? 0) >= max) {
		throw new ChannelLimitError(max, plan);
	}

	const config = channelConfigSchema.parse(
		input.config ?? defaultChannelConfig(),
	);

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
		youtubeRefreshToken: null,
		boundYoutubeChannelId: null,
		createdAt: now,
		updatedAt: now,
	});

	const created = await getChannelForUser(input.userId, id);
	if (!created) {
		throw new Error("Channel insert failed.");
	}
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
		patch.config = channelConfigSchema.parse(input.config);
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
		patch.youtubeRefreshToken = null;
		if (!existing.boundYoutubeChannelId && existing.externalChannelId) {
			patch.boundYoutubeChannelId = existing.externalChannelId.trim();
		}
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
	return next;
}

/** OAuth callback only: persist YouTube tokens + channel metadata. */
/** Server-only: read stored OAuth refresh token for validation / refresh flows. */
export async function getYoutubeRefreshTokenForChannel(
	userId: string,
	channelId: string,
): Promise<string | null> {
	const db = getDb();
	const rows = await db
		.select({ t: channels.youtubeRefreshToken })
		.from(channels)
		.where(and(eq(channels.id, channelId), eq(channels.userId, userId)))
		.limit(1);
	const t = rows[0]?.t;
	return t?.trim() ? t : null;
}

/**
 * Clears only the stored Google refresh token (e.g. after Google returns
 * `invalid_grant`). Keeps `boundYoutubeChannelId` and channel metadata so the
 * user can reconnect to the same YouTube channel.
 */
export async function clearYoutubeRefreshTokenOnly(input: {
	userId: string;
	channelId: string;
}): Promise<void> {
	const db = getDb();
	await db
		.update(channels)
		.set({
			youtubeRefreshToken: null,
			updatedAt: new Date(),
		})
		.where(
			and(eq(channels.id, input.channelId), eq(channels.userId, input.userId)),
		);
}

export async function setChannelYoutubeConnection(input: {
	userId: string;
	channelId: string;
	refreshToken: string;
	externalChannelId: string;
	externalChannelTitle: string | null;
	externalChannelHandle: string | null;
	externalChannelThumbnailUrl: string | null;
}): Promise<void> {
	const db = getDb();
	await setChannelYoutubeConnectionTx(db, input);
}

/**
 * Same as {@link setChannelYoutubeConnection} but uses the given executor (e.g.
 * transaction client) so it can run inside `FOR UPDATE` flows.
 */
export async function setChannelYoutubeConnectionTx(
	tx: LocalDb,
	input: {
		userId: string;
		channelId: string;
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
			platform: "youtube",
			externalChannelId: trimmedId,
			externalChannelTitle: input.externalChannelTitle?.trim() || null,
			externalChannelHandle: input.externalChannelHandle?.trim() || null,
			externalChannelThumbnailUrl:
				input.externalChannelThumbnailUrl?.trim() || null,
			youtubeRefreshToken: input.refreshToken,
			boundYoutubeChannelId: existing.boundYoutubeChannelId ?? trimmedId,
			updatedAt: new Date(),
		})
		.where(
			and(eq(channels.id, input.channelId), eq(channels.userId, input.userId)),
		);
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
}
