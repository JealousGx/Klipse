import "@tanstack/react-start/server-only";

import { asc, eq, lte } from "drizzle-orm";

import { getDb } from "@/db";
import { storedFiles } from "@/db/schema/stored-files";
import { deleteFile } from "@/lib/storage/r2.server";

const BATCH = 80;

/**
 * Deletes expired R2 objects and their `stored_files` rows (FEATURE_DOC §2.7–2.8).
 */
export async function purgeExpiredStoredFiles(): Promise<{
	deleted: number;
	errors: number;
}> {
	const db = getDb();
	const now = new Date();
	let deleted = 0;
	let errors = 0;

	const rows = await db
		.select({
			id: storedFiles.id,
			logicalKey: storedFiles.logicalKey,
		})
		.from(storedFiles)
		.where(lte(storedFiles.expiresAt, now))
		.orderBy(asc(storedFiles.expiresAt))
		.limit(BATCH);

	for (const row of rows) {
		try {
			await deleteFile(row.logicalKey);
			await db.delete(storedFiles).where(eq(storedFiles.id, row.id));
			deleted += 1;
		} catch {
			errors += 1;
		}
	}

	return { deleted, errors };
}
