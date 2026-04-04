import { relations, sql } from "drizzle-orm";
import {
	index,
	int,
	mysqlEnum,
	mysqlTable,
	text,
	timestamp,
	uniqueIndex,
	varchar,
} from "drizzle-orm/mysql-core";

import { users } from "./users";

/**
 * Outbox for Polar usage metering: DB commits credits + ledger first; workers ingest
 * `klipse.usage` asynchronously and retry without refunding credits.
 */
export const polarUsageSync = mysqlTable(
	"polar_usage_sync",
	{
		id: varchar("id", { length: 64 }).primaryKey(),
		userId: varchar("user_id", { length: 64 })
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		/** Same as Polar `external_id` / job ref — dedupe key for metering. */
		externalId: varchar("external_id", { length: 128 }).notNull(),
		credits: int("credits").notNull(),
		/** `POLAR_USAGE_STAGES` value (e.g. `stub`). */
		stage: varchar("stage", { length: 32 }).notNull(),
		status: mysqlEnum("status", ["pending", "processing", "synced"])
			.notNull()
			.default("pending"),
		attempts: int("attempts").notNull().default(0),
		lastError: text("last_error"),
		createdAt: timestamp("created_at", { fsp: 3 })
			.default(sql`CURRENT_TIMESTAMP(3)`)
			.notNull(),
		updatedAt: timestamp("updated_at", { fsp: 3 })
			.default(sql`CURRENT_TIMESTAMP(3)`)
			.notNull(),
	},
	(table) => [
		index("polar_usage_sync_userId_idx").on(table.userId),
		index("polar_usage_sync_status_createdAt_idx").on(
			table.status,
			table.createdAt,
		),
		uniqueIndex("polar_usage_sync_externalId_uidx").on(table.externalId),
	],
);

export const polarUsageSyncRelations = relations(polarUsageSync, ({ one }) => ({
	user: one(users, {
		fields: [polarUsageSync.userId],
		references: [users.id],
	}),
}));
