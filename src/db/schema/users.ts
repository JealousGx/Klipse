import { sql } from "drizzle-orm"
import {
	boolean,
	int,
	mysqlEnum,
	mysqlTable,
	text,
	timestamp,
	varchar,
} from "drizzle-orm/mysql-core"

export const users = mysqlTable("users", {
	id: varchar("id", { length: 64 }).primaryKey(),
	name: varchar("name", { length: 255 }).notNull(),
	email: varchar("email", { length: 255 }).notNull().unique(),
	emailVerified: boolean("email_verified").default(false).notNull(),
	image: text("image"),
	// ── Better Auth admin plugin fields ───────────────────────────────────
	/**
	 * Account role string. "user" (default) or "admin".
	 * Managed by the Better Auth admin plugin; arbitrary roles supported.
	 * Bootstrapped via ADMIN_EMAILS env var on first admin sign-in.
	 */
	role: varchar("role", { length: 64 }).default("user"),
	/** Set to true when an admin bans this account. */
	banned: boolean("banned").default(false),
	/** Human-readable reason for the ban. */
	banReason: text("ban_reason"),
	/** If set, the ban lifts automatically at this timestamp. */
	banExpires: timestamp("ban_expires", { fsp: 3 }),
	plan: mysqlEnum("plan", ["free", "starter", "creator", "empire"])
		.default("free")
		.notNull(),
	creditsRemaining: int("credits_remaining").default(0).notNull(),
	creditsUsed: int("credits_used").default(0).notNull(),
	freeVideoConsumed: boolean("free_video_consumed").default(false).notNull(),
	/**
	 * Destination “replacement” count this billing cycle (switching to a different
	 * account of the same publishing destination on a slot that already had one).
	 * Reset by Polar webhooks.
	 */
	destinationReplacementsUsed: int("destination_replacements_used")
		.default(0)
		.notNull(),
	/**
	 * Email notification preferences.
	 * `notifyVideoApproval` — fires when a video is ready and the channel is in
	 *   “ask-first” mode (user must approve before publishing).
	 * `notifyVideoReady`   — fires whenever any video finishes generating.
	 */
	notifyVideoApproval: boolean("notify_video_approval").default(true).notNull(),
	notifyVideoReady: boolean("notify_video_ready").default(true).notNull(),
	createdAt: timestamp("created_at", { fsp: 3 })
		.default(sql`CURRENT_TIMESTAMP(3)`)
		.notNull(),
	updatedAt: timestamp("updated_at", { fsp: 3 })
		.default(sql`CURRENT_TIMESTAMP(3)`)
		.notNull(),
})
