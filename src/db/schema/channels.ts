import { sql } from "drizzle-orm";
import {
	index,
	json,
	mysqlEnum,
	mysqlTable,
	timestamp,
	varchar,
} from "drizzle-orm/mysql-core";

import { users } from "./users";

/** Platform account linked to this publishing destination (OAuth / API). */
export const channelPlatformEnum = mysqlEnum("platform", [
	"unlinked",
	"youtube",
	"tiktok",
	"instagram",
]);

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
		/** e.g. `youtube` after OAuth; `unlinked` until connected. */
		platform: channelPlatformEnum.notNull().default("unlinked"),
		/**
		 * Provider’s channel id (e.g. YouTube channel id `UC…`).
		 * Shown in UI for support, uploads, and analytics correlation.
		 */
		externalChannelId: varchar("external_channel_id", { length: 64 }),
		/** Display title from the platform API (e.g. YouTube channel title). */
		externalChannelTitle: varchar("external_channel_title", { length: 512 }),
		/** Handle / @username when the platform exposes it (optional). */
		externalChannelHandle: varchar("external_channel_handle", { length: 255 }),
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
