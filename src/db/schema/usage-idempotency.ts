import { relations, sql } from "drizzle-orm";
import {
	index,
	json,
	mysqlEnum,
	mysqlTable,
	timestamp,
	uniqueIndex,
	varchar,
} from "drizzle-orm/mysql-core";

import { users } from "./users";

export type StubGenerateIdempotencyResult = {
	creditsRemaining: number;
	ref: string;
	creditsCharged: number;
};

/**
 * Dedupe keyed operations (e.g. stub generate) so retries / double submits do not double-charge.
 */
export const usageIdempotency = mysqlTable(
	"usage_idempotency",
	{
		id: varchar("id", { length: 64 }).primaryKey(),
		userId: varchar("user_id", { length: 64 })
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		/** e.g. `stub_generate` */
		scope: varchar("scope", { length: 32 }).notNull(),
		clientKey: varchar("client_key", { length: 128 }).notNull(),
		status: mysqlEnum("status", ["processing", "completed"]).notNull(),
		/** Job / Polar `external_id` — set when row is claimed. */
		ref: varchar("ref", { length: 128 }),
		result: json("result").$type<StubGenerateIdempotencyResult | null>(),
		createdAt: timestamp("created_at", { fsp: 3 })
			.default(sql`CURRENT_TIMESTAMP(3)`)
			.notNull(),
		updatedAt: timestamp("updated_at", { fsp: 3 })
			.default(sql`CURRENT_TIMESTAMP(3)`)
			.notNull(),
	},
	(table) => [
		uniqueIndex("usage_idempotency_user_scope_key_uidx").on(
			table.userId,
			table.scope,
			table.clientKey,
		),
		index("usage_idempotency_userId_idx").on(table.userId),
	],
);

export const usageIdempotencyRelations = relations(
	usageIdempotency,
	({ one }) => ({
		user: one(users, {
			fields: [usageIdempotency.userId],
			references: [users.id],
		}),
	}),
);
