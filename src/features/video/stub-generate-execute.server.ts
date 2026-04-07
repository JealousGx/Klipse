import "@tanstack/react-start/server-only";

import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { usageIdempotency } from "@/db/schema";
import type { StubGenerateIdempotencyResult } from "@/db/schema/usage-idempotency";
import { videoJobs } from "@/db/schema/video-jobs";
import {
	applyUsageDeduction,
	firePolarUsageIngestAfterDeduction,
	InsufficientCreditsError,
} from "@/features/billing/credit-usage.server";
import { POLAR_USAGE_STAGES } from "@/features/billing/meter-events";
import { ChannelNotFoundError } from "@/features/channels/channel-errors";
import { getChannelForUser } from "@/features/channels/channels.service.server";
import { enqueueVideoJobDispatch } from "@/lib/worker/enqueue.server";
import { jobRowId, usageIdempotencyRowId } from "@/lib/id";

import { PIPELINE_KIND, PIPELINE_STAGE } from "./pipeline/pipeline-kind";
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
	channelId: string;
	idempotencyKey: string;
}): Promise<ExecuteStubGenerateOutcome> {
	const credits = estimateStubGenerateCredits();
	const clientKey = input.idempotencyKey.trim();
	const channelId = input.channelId.trim();
	const db = getDb();

	if (!(await getChannelForUser(input.userId, channelId))) {
		throw new ChannelNotFoundError();
	}

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

				const now = new Date();
				await tx.insert(videoJobs).values({
					id: ref,
					userId: input.userId,
					channelId,
					pipelineKind: PIPELINE_KIND.STUB_PIPELINE,
					status: "queued",
					progress: 0,
					currentStage: PIPELINE_STAGE.QUEUED,
					costCredits: credits,
					outputUrl: null,
					errorMessage: null,
					createdAt: now,
					updatedAt: now,
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
		firePolarUsageIngestAfterDeduction({
			userId: input.userId,
			credits,
			stage: POLAR_USAGE_STAGES.stubGenerate,
			ref: outcome.payload.ref,
		});
		await enqueueVideoJobDispatch({
			jobId: outcome.payload.ref,
			userId: input.userId,
			pipelineKind: PIPELINE_KIND.STUB_PIPELINE,
		});
	}

	return outcome;
}
