import { relations, sql } from "drizzle-orm"
import {
	boolean,
	index,
	int,
	mysqlEnum,
	mysqlTable,
	timestamp,
	unique,
	varchar,
} from "drizzle-orm/mysql-core"

import { channels } from "./channels"
import { users } from "./users"

/**
 * One row per channel — drives the automated content generation loop (FEATURE_DOC §2.11).
 * The cron reads rows where `enabled = true AND nextRunAt <= now()`, fires a content
 * pipeline job for each, then advances `nextRunAt` by the frequency + a random jitter so
 * all channels don't fire at the exact same second.
 */
export const schedules = mysqlTable(
	"schedules",
	{
		id: varchar("id", { length: 64 }).primaryKey(),
		userId: varchar("user_id", { length: 64 })
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		/** One schedule per channel — enforced by unique constraint below. */
		channelId: varchar("channel_id", { length: 64 })
			.notNull()
			.references(() => channels.id, { onDelete: "cascade" }),
		frequency: mysqlEnum("frequency", [
			"daily",
			"every_2_days",
			"every_3_days",
			"every_4_days",
			"every_5_days",
			"every_6_days",
			"weekly",
			"every_2_weeks",
			"every_3_weeks",
			"monthly",
		]).notNull(),
		/** When the next pipeline job should be triggered. */
		nextRunAt: timestamp("next_run_at", { fsp: 3 }).notNull(),
		/**
		 * Upper bound of random offset (minutes) added to each `nextRunAt` after a run.
		 * Prevents all channels from firing at the same second when they share a frequency.
		 */
		jitterMinutes: int("jitter_minutes").notNull().default(360),
		enabled: boolean("enabled").notNull().default(true),
		lastRunAt: timestamp("last_run_at", { fsp: 3 }),
		createdAt: timestamp("created_at", { fsp: 3 })
			.default(sql`CURRENT_TIMESTAMP(3)`)
			.notNull(),
		updatedAt: timestamp("updated_at", { fsp: 3 })
			.default(sql`CURRENT_TIMESTAMP(3)`)
			.notNull(),
	},
	(t) => [
		unique("schedules_channelId_unique").on(t.channelId),
		index("schedules_userId_idx").on(t.userId),
		/**
		 * Cron query: WHERE enabled = 1 AND nextRunAt <= ?
		 * Leading with the equality column (enabled) narrows to active schedules first,
		 * then range-scans nextRunAt — far fewer rows than leading with the range column.
		 */
		index("schedules_enabled_nextRunAt_idx").on(t.enabled, t.nextRunAt),
	],
)

export const schedulesRelations = relations(schedules, ({ one }) => ({
	user: one(users, {
		fields: [schedules.userId],
		references: [users.id],
	}),
	channel: one(channels, {
		fields: [schedules.channelId],
		references: [channels.id],
	}),
}))
