import "@tanstack/react-start/server-only";

import { and, asc, eq, lt, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { polarUsageSync } from "@/db/schema";
import {
	POLAR_USAGE_EVENT_NAME,
	POLAR_USAGE_STAGES,
	type PolarUsageMetadata,
} from "./meter-events";
import { ingestPolarUsageEvents } from "./polar-metering.server";

const STALE_PROCESSING_MS = 15 * 60 * 1000;

async function resetStaleProcessingRows(): Promise<void> {
	const db = getDb();
	const staleBefore = new Date(Date.now() - STALE_PROCESSING_MS);

	await db
		.update(polarUsageSync)
		.set({
			status: "pending",
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(polarUsageSync.status, "processing"),
				lt(polarUsageSync.updatedAt, staleBefore),
			),
		);
}

const POLAR_STAGE_VALUES = new Set<string>(
	Object.values(POLAR_USAGE_STAGES) as string[],
);

function stageForIngest(
	raw: string,
): NonNullable<PolarUsageMetadata["stage"]> | undefined {
	return POLAR_STAGE_VALUES.has(raw)
		? (raw as NonNullable<PolarUsageMetadata["stage"]>)
		: undefined;
}

/**
 * Claims pending outbox rows, ingests to Polar, marks `synced` or re-queues as `pending`.
 */
export async function processPolarUsageSyncBatch(input: {
	limit: number;
}): Promise<{
	synced: number;
	requeued: number;
}> {
	const db = getDb();
	try {
		await resetStaleProcessingRows();
	} catch {
		// best-effort; batch can still process fresh pending rows
	}

	let synced = 0;
	let requeued = 0;
	const max = Math.max(1, input.limit);

	for (let i = 0; i < max; i++) {
		const row = await db.transaction(async (tx) => {
			const rows = await tx
				.select()
				.from(polarUsageSync)
				.where(eq(polarUsageSync.status, "pending"))
				.orderBy(asc(polarUsageSync.createdAt))
				.limit(1)
				.for("update", { skipLocked: true });

			const found = rows[0];
			if (!found) {
				return null;
			}

			await tx
				.update(polarUsageSync)
				.set({ status: "processing", updatedAt: new Date() })
				.where(eq(polarUsageSync.id, found.id));

			return { ...found, status: "processing" as const };
		});
		if (!row) {
			break;
		}

		const stage = stageForIngest(row.stage);

		try {
			await ingestPolarUsageEvents({
				userId: row.userId,
				events: [
					{
						name: POLAR_USAGE_EVENT_NAME,
						externalId: row.externalId,
						metadata: {
							credits: row.credits,
							...(stage != null ? { stage } : {}),
							ref: row.externalId,
						},
					},
				],
			});

			await db
				.update(polarUsageSync)
				.set({
					status: "synced",
					lastError: null,
					updatedAt: new Date(),
				})
				.where(eq(polarUsageSync.id, row.id));
			synced++;
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			await db
				.update(polarUsageSync)
				.set({
					status: "pending",
					attempts: sql`${polarUsageSync.attempts} + 1`,
					lastError: message,
					updatedAt: new Date(),
				})
				.where(eq(polarUsageSync.id, row.id));
			requeued++;
		}
	}

	return { synced, requeued };
}
