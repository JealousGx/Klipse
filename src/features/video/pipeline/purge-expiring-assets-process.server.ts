import "@tanstack/react-start/server-only";

import { asc, eq, lte } from "drizzle-orm";

import { getDb } from "@/db";
import { expiringAssets } from "@/db/schema/expiring-assets";
import { logger } from "@/lib/logger";
import { deleteFile } from "@/lib/storage/r2.server";

const BATCH = 80;

/**
 * Deletes expired R2 objects and their `expiring_assets` rows.
 * Runs on a cron schedule via `POST /api/cron/purge-expiring-assets`.
 */
export async function purgeExpiredAssets(): Promise<{
	deleted: number;
	errors: number;
}> {
	const db = getDb();
	const now = new Date();
	let deleted = 0;
	let errors = 0;

	const rows = await db
		.select({
			id: expiringAssets.id,
			logicalKey: expiringAssets.logicalKey,
		})
		.from(expiringAssets)
		.where(lte(expiringAssets.expiresAt, now))
		.orderBy(asc(expiringAssets.expiresAt))
		.limit(BATCH);

	for (const row of rows) {
		try {
			await deleteFile(row.logicalKey);
			await db.delete(expiringAssets).where(eq(expiringAssets.id, row.id));
			deleted += 1;
		} catch {
			errors += 1;
		}
	}

	logger.info("purge_expired_assets_complete", { deleted, errors });

	return { deleted, errors };
}
