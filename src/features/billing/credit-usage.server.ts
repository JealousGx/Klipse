import "@tanstack/react-start/server-only";

import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { creditTransactions, users } from "@/db/schema";
import { creditTransactionId } from "@/lib/id";
import { logger } from "@/lib/logger";

import type { PolarUsageMetadata } from "./meter-events";
import { POLAR_USAGE_EVENT_NAME } from "./meter-events";
import { ingestPolarUsageEvents } from "./polar-metering.server";

/** Transaction handle from `getDb().transaction` — used to compose idempotent flows. */
export type CreditUsageTx = Parameters<
	Parameters<ReturnType<typeof getDb>["transaction"]>[0]
>[0];

export class InsufficientCreditsError extends Error {
	readonly required: number;
	readonly remaining: number;

	constructor(required: number, remaining: number) {
		super("INSUFFICIENT_CREDITS");
		this.name = "InsufficientCreditsError";
		this.required = required;
		this.remaining = remaining;
	}
}

type UsageStage = NonNullable<PolarUsageMetadata["stage"]>;

/** Balance fields from the same DB transaction after locking the user row (e.g. entitlement snapshot). */
export type PrelockedCreditBalance = {
	creditsRemaining: number;
	creditsUsed: number;
};

/**
 * Ledger convention: `type: "usage"` rows use **negative** `amount` (credits removed).
 * `metadata.creditsAbs` holds the magnitude for analytics / Polar alignment.
 */
export async function applyUsageDeduction(
	tx: CreditUsageTx,
	input: {
		userId: string;
		credits: number;
		stage: UsageStage;
		ref: string;
		/**
		 * When set, skips a redundant `users` read; must match the row locked for this transaction
		 * (e.g. `selectUserEntitlementSnapshotForUpdate`).
		 */
		prelockedBalance?: PrelockedCreditBalance;
	},
): Promise<{ creditsRemaining: number }> {
	if (input.credits <= 0) {
		throw new Error("credits must be positive");
	}

	let creditsRemaining: number;
	let creditsUsed: number;

	if (input.prelockedBalance) {
		creditsRemaining = input.prelockedBalance.creditsRemaining;
		creditsUsed = input.prelockedBalance.creditsUsed;
	} else {
		const [user] = await tx
			.select()
			.from(users)
			.where(eq(users.id, input.userId))
			.limit(1);

		if (!user) {
			throw new Error("USER_NOT_FOUND");
		}
		creditsRemaining = user.creditsRemaining;
		creditsUsed = user.creditsUsed;
	}

	if (creditsRemaining < input.credits) {
		throw new InsufficientCreditsError(input.credits, creditsRemaining);
	}

	const newRemaining = creditsRemaining - input.credits;
	const newUsed = creditsUsed + input.credits;

	await tx
		.update(users)
		.set({
			creditsRemaining: newRemaining,
			creditsUsed: newUsed,
			updatedAt: new Date(),
		})
		.where(eq(users.id, input.userId));

	await tx.insert(creditTransactions).values({
		id: creditTransactionId(),
		userId: input.userId,
		type: "usage",
		amount: -input.credits,
		metadata: {
			kind: "usage",
			stage: input.stage,
			ref: input.ref,
			creditsAbs: input.credits,
		},
	});

	return { creditsRemaining: newRemaining };
}

/**
 * Fire-and-forget Polar metering after credits are committed. Does not block or refund on failure.
 */
export function firePolarUsageIngestAfterDeduction(input: {
	userId: string;
	credits: number;
	stage: UsageStage;
	ref: string;
}): void {
	void ingestPolarUsageEvents({
		userId: input.userId,
		events: [
			{
				name: POLAR_USAGE_EVENT_NAME,
				externalId: input.ref,
				metadata: {
					credits: input.credits,
					stage: input.stage,
					ref: input.ref,
				},
			},
		],
	}).catch((err) => {
		logger.error("[polar_usage_ingest]", {
			error: err instanceof Error ? err.message : String(err),
		});
	});
}

/**
 * Balance check, deduct credits, usage ledger row (`amount` negative), then Polar ingest (async).
 */
export async function deductCreditsForUsage(input: {
	userId: string;
	credits: number;
	stage: UsageStage;
	ref: string;
}): Promise<{ creditsRemaining: number }> {
	const db = getDb();

	const { creditsRemaining } = await db.transaction(async (tx) => {
		return applyUsageDeduction(tx, input);
	});

	firePolarUsageIngestAfterDeduction(input);
	return { creditsRemaining };
}
