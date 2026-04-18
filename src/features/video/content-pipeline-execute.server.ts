import "@tanstack/react-start/server-only";

import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { usageIdempotency } from "@/db/schema";
import type { StubGenerateIdempotencyResult } from "@/db/schema/usage-idempotency";
import type { VideoJobInputPayload } from "@/db/schema/video-jobs";
import { videoJobs } from "@/db/schema/video-jobs";
import { env } from "@/env";
import {
	applyUsageDeduction,
	firePolarUsageIngestAfterDeduction,
	InsufficientCreditsError,
} from "@/features/billing/credit-usage.server";
import { POLAR_USAGE_STAGES } from "@/features/billing/meter-events";
import { ChannelNotFoundError } from "@/features/channels/channel-errors";
import { getChannelForUser } from "@/features/channels/channels.service.server";
import {
	assertFreeTierAssemblyQuotaAllowed,
	selectUserEntitlementSnapshotForUpdate,
} from "@/features/entitlements";
import { jobRowId, usageIdempotencyRowId } from "@/lib/id";
import { logger } from "@/lib/logger";
import { estimateContentPipelineCredits } from "./content-pipeline-estimate";
import { dispatchContentJob } from "./pipeline/dispatch-content-job.server";
import { PIPELINE_KIND, PIPELINE_STAGE } from "./pipeline/pipeline-kind";

export const CONTENT_PIPELINE_IDEMPOTENCY_SCOPE = "content_pipeline";

function isMysqlDuplicateKeyError(e: unknown): boolean {
	if (typeof e !== "object" || e === null) {
		return false;
	}
	const err = e as { code?: string; errno?: number };
	return err.code === "ER_DUP_ENTRY" || err.errno === 1062;
}

export type ExecuteContentPipelineOutcome =
	| { kind: "fresh"; payload: StubGenerateIdempotencyResult }
	| { kind: "replay"; payload: StubGenerateIdempotencyResult };

/**
 * Idempotent billing + `video_jobs` row (script → prepare → assembly).
 * Job is created with status="queued"; cron dispatch picks it up within 1 minute.
 * Reuses free-tier single-assembly quota with standalone assembly jobs.
 */
export async function executeContentPipelineWithIdempotency(input: {
	userId: string;
	channelId: string;
	idempotencyKey: string;
	idea: string;
}): Promise<ExecuteContentPipelineOutcome> {
	const clientKey = input.idempotencyKey.trim();
	const channelId = input.channelId.trim();
	const idea = input.idea.trim();

	const credits = estimateContentPipelineCredits({ idea });

	const db = getDb();

	if (!(await getChannelForUser(input.userId, channelId))) {
		throw new ChannelNotFoundError();
	}

	const inputPayload: VideoJobInputPayload = { idea };

	const outcome = await db.transaction(async (tx) => {
		const snapshot = await selectUserEntitlementSnapshotForUpdate(
			tx,
			input.userId,
		);
		if (!snapshot) {
			throw new Error("USER_NOT_FOUND");
		}
		assertFreeTierAssemblyQuotaAllowed(snapshot);

		const maxIterations = 12;
		for (let i = 0; i < maxIterations; i++) {
			const rows = await tx
				.select()
				.from(usageIdempotency)
				.where(
					and(
						eq(usageIdempotency.userId, input.userId),
						eq(usageIdempotency.scope, CONTENT_PIPELINE_IDEMPOTENCY_SCOPE),
						eq(usageIdempotency.clientKey, clientKey),
					),
				)
				.for("update");

			const existing = rows[0];
			if (existing?.status === "completed" && existing.result) {
				logger.info("content_pipeline_idempotency_replay", {
					userId: input.userId,
					channelId,
					idempotencyKey: clientKey,
					ref: existing.result.ref,
				});
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
						scope: CONTENT_PIPELINE_IDEMPOTENCY_SCOPE,
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
						eq(usageIdempotency.scope, CONTENT_PIPELINE_IDEMPOTENCY_SCOPE),
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
					stage: POLAR_USAGE_STAGES.contentPipeline,
					ref,
					prelockedBalance: {
						creditsRemaining: snapshot.creditsRemaining,
						creditsUsed: snapshot.creditsUsed,
					},
				});

				const now = new Date();
				await tx.insert(videoJobs).values({
					id: ref,
					userId: input.userId,
					channelId,
					pipelineKind: PIPELINE_KIND.CONTENT_PIPELINE_V1,
					inputPayload,
					artifacts: null,
					status: "queued",
					progress: 0,
					currentStage: PIPELINE_STAGE.SCRIPT,
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

				logger.info("content_pipeline_job_created", {
					userId: input.userId,
					channelId,
					jobId: ref,
					credits,
					creditsRemaining,
				});

				return { kind: "fresh" as const, payload };
			} catch (e) {
				if (e instanceof InsufficientCreditsError) {
					logger.warn("content_pipeline_insufficient_credits", {
						userId: input.userId,
						channelId,
						credits,
						creditsRemaining: snapshot.creditsRemaining,
					});
					await tx
						.delete(usageIdempotency)
						.where(eq(usageIdempotency.id, row.id));
				}
				throw e;
			}
		}

		logger.error("content_pipeline_idempotency_claim_exhausted", {
			userId: input.userId,
			channelId,
			idempotencyKey: clientKey,
		});
		throw new Error("usage_idempotency_claim_exhausted");
	});

	if (outcome.kind === "fresh") {
		firePolarUsageIngestAfterDeduction({
			userId: input.userId,
			credits,
			stage: POLAR_USAGE_STAGES.contentPipeline,
			ref: outcome.payload.ref,
		});

		if (env.ENVIRONMENT !== "production") {
			// Local/dev: skip cron wait — dispatch immediately (fire-and-forget).
			dispatchContentJob(outcome.payload.ref).catch((err) =>
				logger.error("[local-dispatch] immediate dispatch failed", {
					jobId: outcome.payload.ref,
					error: err instanceof Error ? err.message : String(err),
				}),
			);
		}
		// Production: status="queued" — cron dispatch picks it up within 1 minute.
	}

	return outcome;
}
