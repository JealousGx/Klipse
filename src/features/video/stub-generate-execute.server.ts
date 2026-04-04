import "@tanstack/react-start/server-only";

import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { usageIdempotency } from "@/db/schema";
import type { StubGenerateIdempotencyResult } from "@/db/schema/usage-idempotency";
import {
	applyUsageDeduction,
	InsufficientCreditsError,
} from "@/features/billing/credit-usage.server";
import { POLAR_USAGE_STAGES } from "@/features/billing/meter-events";
import { schedulePolarUsageSyncProcessing } from "@/features/billing/polar-usage-sync-schedule.server";
import { jobRowId, usageIdempotencyRowId } from "@/lib/id";

import { estimateStubGenerateCredits } from "./stub-generate-cost";

export const STUB_GENERATE_SCOPE = "stub_generate";

function isMysqlDuplicateKeyError(e: unknown): boolean {
	if (typeof e !== "object" || e === null) {
		return false;
	}
	const err = e as { code?: string; errno?: number };
	return err.code === "ER_DUP_ENTRY" || err.errno === 1062;
}

export type ExecuteStubGenerateOutcome =
	| { kind: "fresh"; payload: StubGenerateIdempotencyResult }
	| { kind: "replay"; payload: StubGenerateIdempotencyResult };

/**
 * Stub generate: idempotent claim + single DB transaction (credits + ledger + Polar outbox + idempotency completed).
 */
export async function executeStubGenerateWithIdempotency(input: {
	userId: string;
	idempotencyKey: string;
}): Promise<ExecuteStubGenerateOutcome> {
	const credits = estimateStubGenerateCredits();
	const clientKey = input.idempotencyKey.trim();
	const db = getDb();

	const outcome = await db.transaction(async (tx) => {
		const maxIterations = 12;
		for (let i = 0; i < maxIterations; i++) {
			const rows = await tx
				.select()
				.from(usageIdempotency)
				.where(
					and(
						eq(usageIdempotency.userId, input.userId),
						eq(usageIdempotency.scope, STUB_GENERATE_SCOPE),
						eq(usageIdempotency.clientKey, clientKey),
					),
				)
				.for("update");

			const existing = rows[0];
			if (existing?.status === "completed" && existing.result) {
				return {
					kind: "replay" as const,
					payload: existing.result,
				};
			}

			if (!existing) {
				try {
					await tx.insert(usageIdempotency).values({
						id: usageIdempotencyRowId(),
						userId: input.userId,
						scope: STUB_GENERATE_SCOPE,
						clientKey,
						status: "processing",
						ref: jobRowId(),
						result: null,
					});
				} catch (e) {
					if (!isMysqlDuplicateKeyError(e)) {
						throw e;
					}
					continue;
				}
			}

			const locked = await tx
				.select()
				.from(usageIdempotency)
				.where(
					and(
						eq(usageIdempotency.userId, input.userId),
						eq(usageIdempotency.scope, STUB_GENERATE_SCOPE),
						eq(usageIdempotency.clientKey, clientKey),
					),
				)
				.for("update");

			const row = locked[0];
			if (!row) {
				continue;
			}

			if (row.status === "completed" && row.result) {
				return { kind: "replay" as const, payload: row.result };
			}

			const ref = row.ref;
			if (!ref) {
				throw new Error("usage_idempotency_missing_ref");
			}

			try {
				const { creditsRemaining } = await applyUsageDeduction(tx, {
					userId: input.userId,
					credits,
					stage: POLAR_USAGE_STAGES.stubGenerate,
					ref,
				});

				const payload: StubGenerateIdempotencyResult = {
					creditsRemaining,
					ref,
					creditsCharged: credits,
				};

				await tx
					.update(usageIdempotency)
					.set({
						status: "completed",
						result: payload,
						updatedAt: new Date(),
					})
					.where(eq(usageIdempotency.id, row.id));

				return { kind: "fresh" as const, payload };
			} catch (e) {
				if (e instanceof InsufficientCreditsError) {
					await tx
						.delete(usageIdempotency)
						.where(eq(usageIdempotency.id, row.id));
				}
				throw e;
			}
		}

		throw new Error("usage_idempotency_claim_exhausted");
	});

	if (outcome.kind === "fresh") {
		schedulePolarUsageSyncProcessing();
	}

	return outcome;
}
