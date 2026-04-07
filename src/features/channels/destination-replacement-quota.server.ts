import "@tanstack/react-start/server-only";

import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import type { LocalDb } from "@/db/local";
import { channels, users } from "@/db/schema";

import {
	maxDestinationReplacementsPerCycle,
	planAllowsPaidPublishingConnections,
} from "@/features/billing/tier-config";
import type { MeResponse } from "@/features/user/types/me";

import { ChannelNotFoundError } from "./channel-errors";
import { setChannelOAuthConnectionTx } from "./channels.service.server";
import {
	consumesDestinationReplacementQuota,
	priorExternalChannelIdFromDestinationRow,
} from "./destination-replacement-policy";

export type ApplyDestinationConnectionResult =
	| { ok: true }
	| {
			ok: false;
			code: "free_plan_blocked" | "destination_replacements_exhausted";
	  };

type ChannelRowSelect = typeof channels.$inferSelect;

/**
 * Core transactional flow: lock user + destination rows, apply replacement quota,
 * then run platform-specific persistence (YouTube OAuth today; pass a different
 * `persistAfterQuotaCheck` for Instagram/TikTok later).
 */
export async function runDestinationReplacementQuotaTransaction(input: {
	userId: string;
	channelId: string;
	newExternalChannelId: string;
	/**
	 * How to read “what was linked before” from the DB row. Defaults to YouTube
	 * bound/external columns; swap for other platforms when you add columns or rules.
	 */
	priorExternalChannelIdFromChannelRow?: (
		row: ChannelRowSelect,
	) => string | null;
	persistAfterQuotaCheck: (tx: LocalDb) => Promise<void>;
}): Promise<ApplyDestinationConnectionResult> {
	const db = getDb();
	const trimmedNew = input.newExternalChannelId.trim();
	const resolvePrior =
		input.priorExternalChannelIdFromChannelRow ??
		((row: ChannelRowSelect) =>
			priorExternalChannelIdFromDestinationRow({
				boundExternalAccountId: row.boundExternalAccountId,
				externalChannelId: row.externalChannelId,
			}));

	return db.transaction(async (tx) => {
		const [u] = await tx
			.select({
				plan: users.plan,
				destinationReplacementsUsed: users.destinationReplacementsUsed,
			})
			.from(users)
			.where(eq(users.id, input.userId))
			.for("update");

		if (!u) {
			return { ok: false, code: "free_plan_blocked" };
		}

		const plan = u.plan as MeResponse["plan"];
		if (!planAllowsPaidPublishingConnections(plan)) {
			return { ok: false, code: "free_plan_blocked" };
		}

		const [chRow] = await tx
			.select()
			.from(channels)
			.where(
				and(
					eq(channels.id, input.channelId),
					eq(channels.userId, input.userId),
				),
			)
			.for("update");

		if (!chRow) {
			throw new ChannelNotFoundError();
		}

		const prior = resolvePrior(chRow);

		const consumes = consumesDestinationReplacementQuota({
			plan,
			priorExternalChannelId: prior,
			newExternalChannelId: trimmedNew,
		});

		if (consumes) {
			const max = maxDestinationReplacementsPerCycle(plan);
			const used = Number(u.destinationReplacementsUsed ?? 0);
			if (used >= max) {
				return { ok: false, code: "destination_replacements_exhausted" };
			}
			await tx
				.update(users)
				.set({
					destinationReplacementsUsed: used + 1,
					updatedAt: new Date(),
				})
				.where(eq(users.id, input.userId));
		}

		await input.persistAfterQuotaCheck(tx);

		return { ok: true };
	});
}

/** Persists OAuth tokens + channel metadata after quota checks. */
export async function applyOAuthConnectionWithQuota(input: {
	userId: string;
	channelId: string;
	platform: "youtube" | "tiktok" | "instagram";
	refreshToken: string;
	externalChannelId: string;
	externalChannelTitle: string | null;
	externalChannelHandle: string | null;
	externalChannelThumbnailUrl: string | null;
}): Promise<ApplyDestinationConnectionResult> {
	return runDestinationReplacementQuotaTransaction({
		userId: input.userId,
		channelId: input.channelId,
		newExternalChannelId: input.externalChannelId,
		persistAfterQuotaCheck: async (tx) => {
			await setChannelOAuthConnectionTx(tx, {
				userId: input.userId,
				channelId: input.channelId,
				platform: input.platform,
				refreshToken: input.refreshToken,
				externalChannelId: input.externalChannelId,
				externalChannelTitle: input.externalChannelTitle,
				externalChannelHandle: input.externalChannelHandle,
				externalChannelThumbnailUrl: input.externalChannelThumbnailUrl,
			});
		},
	});
}

/** Called from Polar webhooks when a new billing cycle begins (plan change / renewal). */
export async function resetDestinationReplacementsUsedForUser(
	userId: string,
): Promise<void> {
	const db = getDb();
	await db
		.update(users)
		.set({
			destinationReplacementsUsed: 0,
			updatedAt: new Date(),
		})
		.where(eq(users.id, userId));
}
