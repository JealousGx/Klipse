import { relations, sql } from "drizzle-orm";
import {
	index,
	int,
	json,
	mysqlEnum,
	mysqlTable,
	timestamp,
	varchar,
} from "drizzle-orm/mysql-core";

import { users } from "./users";

export const creditTransactions = mysqlTable(
	"credit_transactions",
	{
		id: varchar("id", { length: 64 }).primaryKey(),
		userId: varchar("user_id", { length: 64 })
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		type: mysqlEnum("type", ["usage", "purchase", "refund"]).notNull(),
		/** Usage: negative (credits removed). Purchase / typical refund: positive (credits added). */
		amount: int("amount").notNull(),
		metadata: json("metadata"),
		createdAt: timestamp("created_at", { fsp: 3 })
			.default(sql`CURRENT_TIMESTAMP(3)`)
			.notNull(),
	},
	(table) => [
		index("credit_transactions_userId_idx").on(table.userId),
		index("credit_transactions_createdAt_idx").on(table.createdAt),
	],
);

export const creditTransactionsRelations = relations(
	creditTransactions,
	({ one }) => ({
		user: one(users, {
			fields: [creditTransactions.userId],
			references: [users.id],
		}),
	}),
);
