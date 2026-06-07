import { sql } from "drizzle-orm"
import { boolean, mysqlTable, timestamp, varchar } from "drizzle-orm/mysql-core"

/** Fixed primary key — this table always has at most one row. */
export const SITE_SETTINGS_ID = "global"

export const siteSettings = mysqlTable("site_settings", {
	id: varchar("id", { length: 64 }).primaryKey(),
	/** When false, all new user registrations are blocked server-side. */
	registrationEnabled: boolean("registration_enabled").default(true).notNull(),
	updatedAt: timestamp("updated_at", { fsp: 3 })
		.notNull()
		.default(sql`CURRENT_TIMESTAMP(3)`)
		.$onUpdate(() => new Date()),
})
