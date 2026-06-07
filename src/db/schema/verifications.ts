import { sql } from "drizzle-orm"
import {
	index,
	mysqlTable,
	text,
	timestamp,
	varchar,
} from "drizzle-orm/mysql-core"

export const verifications = mysqlTable(
	"verifications",
	{
		id: varchar("id", { length: 128 }).primaryKey(),
		identifier: varchar("identifier", { length: 512 }).notNull(),
		value: text("value").notNull(),
		expiresAt: timestamp("expires_at", { fsp: 3 }).notNull(),
		createdAt: timestamp("created_at", { fsp: 3 })
			.default(sql`CURRENT_TIMESTAMP(3)`)
			.notNull(),
		updatedAt: timestamp("updated_at", { fsp: 3 })
			.default(sql`CURRENT_TIMESTAMP(3)`)
			.notNull(),
	},
	(table) => [index("verifications_identifier_idx").on(table.identifier)],
)
