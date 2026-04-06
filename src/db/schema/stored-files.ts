import { relations, sql } from "drizzle-orm";
import {
	index,
	mysqlTable,
	timestamp,
	varchar,
} from "drizzle-orm/mysql-core";

import { users } from "./users";
import { videoJobs } from "./video-jobs";

/**
 * Tracks R2 objects subject to TTL purge (FEATURE_DOC §2.7–2.8).
 * Row deleted after successful object delete.
 */
export const storedFiles = mysqlTable(
	"stored_files",
	{
		id: varchar("id", { length: 64 }).primaryKey(),
		userId: varchar("user_id", { length: 64 })
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		/** Logical key (same string passed to `uploadToR2` / `deleteFile`). */
		logicalKey: varchar("logical_key", { length: 512 }).notNull(),
		videoJobId: varchar("video_job_id", { length: 64 }).references(
			() => videoJobs.id,
			{ onDelete: "set null" },
		),
		expiresAt: timestamp("expires_at", { fsp: 3 }).notNull(),
		createdAt: timestamp("created_at", { fsp: 3 })
			.default(sql`CURRENT_TIMESTAMP(3)`)
			.notNull(),
	},
	(table) => [
		index("stored_files_expires_idx").on(table.expiresAt),
		index("stored_files_user_idx").on(table.userId),
	],
);

export const storedFilesRelations = relations(storedFiles, ({ one }) => ({
	user: one(users, {
		fields: [storedFiles.userId],
		references: [users.id],
	}),
	job: one(videoJobs, {
		fields: [storedFiles.videoJobId],
		references: [videoJobs.id],
	}),
}));
