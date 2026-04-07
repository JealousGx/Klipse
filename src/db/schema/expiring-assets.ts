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
 * Tracks R2 objects subject to TTL purge.
 * Covers both intermediate pipeline assets (e.g. TTS audio, ~2h TTL) and
 * final output files (plan-based retention window).
 * Row is deleted after the R2 object is successfully removed.
 */
export const expiringAssets = mysqlTable(
	"expiring_assets",
	{
		id: varchar("id", { length: 64 }).primaryKey(),
		userId: varchar("user_id", { length: 64 })
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		/** Logical key passed to `uploadToR2` / `deleteFile` (env prefix applied at runtime). */
		logicalKey: varchar("logical_key", { length: 512 }).notNull(),
		videoJobId: varchar("video_job_id", { length: 64 }).references(
			() => videoJobs.id,
			{ onDelete: "set null" },
		),
		/**
		 * Asset purpose within the pipeline.
		 * - `"tts_intermediate"` — TTS audio uploaded before assembly (~2h TTL)
		 * - `"output"` — final rendered video (plan-based retention)
		 */
		kind: varchar("kind", { length: 32 })
			.$type<"tts_intermediate" | "output">()
			.notNull(),
		expiresAt: timestamp("expires_at", { fsp: 3 }).notNull(),
		createdAt: timestamp("created_at", { fsp: 3 })
			.default(sql`CURRENT_TIMESTAMP(3)`)
			.notNull(),
	},
	(table) => [
		index("expiring_assets_expires_idx").on(table.expiresAt),
		index("expiring_assets_user_idx").on(table.userId),
	],
);

export const expiringAssetsRelations = relations(expiringAssets, ({ one }) => ({
	user: one(users, {
		fields: [expiringAssets.userId],
		references: [users.id],
	}),
	job: one(videoJobs, {
		fields: [expiringAssets.videoJobId],
		references: [videoJobs.id],
	}),
}));
