import { sql } from "drizzle-orm";
import {
	index,
	json,
	mysqlTable,
	timestamp,
	varchar,
} from "drizzle-orm/mysql-core";

import { users } from "./users";

export const channels = mysqlTable(
	"channels",
	{
		id: varchar("id", { length: 64 }).primaryKey(),
		userId: varchar("user_id", { length: 64 })
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		name: varchar("name", { length: 255 }).notNull(),
		niche: varchar("niche", { length: 512 }).notNull(),
		config: json("config").notNull(),
		createdAt: timestamp("created_at", { fsp: 3 })
			.default(sql`CURRENT_TIMESTAMP(3)`)
			.notNull(),
		updatedAt: timestamp("updated_at", { fsp: 3 })
			.default(sql`CURRENT_TIMESTAMP(3)`)
			.notNull(),
	},
	(table) => [
		index("channels_userId_idx").on(table.userId),
		index("channels_createdAt_idx").on(table.createdAt),
	],
);
