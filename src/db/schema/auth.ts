import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
	id: varchar("id", { length: 64 }).primaryKey(),
	name: varchar("name", { length: 255 }).notNull(),
	email: varchar("email", { length: 255 }).notNull().unique(),
	emailVerified: boolean("email_verified").default(false).notNull(),
	image: text("image"),
	createdAt: timestamp("created_at", { fsp: 3 })
		.default(sql`CURRENT_TIMESTAMP(3)`)
		.notNull(),
	updatedAt: timestamp("updated_at", { fsp: 3 })
		.default(sql`CURRENT_TIMESTAMP(3)`)
		.notNull(),
});

export const sessions = mysqlTable(
	"sessions",
	{
		id: varchar("id", { length: 64 }).primaryKey(),
		expiresAt: timestamp("expires_at", { fsp: 3 }).notNull(),
		token: varchar("token", { length: 255 }).notNull().unique(),
		createdAt: timestamp("created_at", { fsp: 3 })
			.default(sql`CURRENT_TIMESTAMP(3)`)
			.notNull(),
		updatedAt: timestamp("updated_at", { fsp: 3 })
			.default(sql`CURRENT_TIMESTAMP(3)`)
			.notNull(),
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		userId: varchar("user_id", { length: 64 })
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
	},
	(table) => [index("sessions_userId_idx").on(table.userId)],
);

export const accounts = mysqlTable(
	"accounts",
	{
		id: varchar("id", { length: 64 }).primaryKey(),
		accountId: text("account_id").notNull(),
		providerId: text("provider_id").notNull(),
		userId: varchar("user_id", { length: 64 })
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		accessToken: text("access_token"),
		refreshToken: text("refresh_token"),
		idToken: text("id_token"),
		accessTokenExpiresAt: timestamp("access_token_expires_at", { fsp: 3 }),
		refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { fsp: 3 }),
		scope: text("scope"),
		password: text("password"),
		createdAt: timestamp("created_at", { fsp: 3 })
			.default(sql`CURRENT_TIMESTAMP(3)`)
			.notNull(),
		updatedAt: timestamp("updated_at", { fsp: 3 })
			.default(sql`CURRENT_TIMESTAMP(3)`)
			.notNull(),
	},
	(table) => [index("accounts_userId_idx").on(table.userId)],
);

export const verifications = mysqlTable(
	"verifications",
	{
		/** Better Auth + prefixed ids (`vrf_…`); 128 avoids edge cases vs CLI defaults. */
		id: varchar("id", { length: 128 }).primaryKey(),
		/** `sign-in-otp-{email}` / hashed identifiers — keep headroom past 255. */
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
);

export const usersRelations = relations(users, ({ many }) => ({
	sessions: many(sessions),
	accounts: many(accounts),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
	users: one(users, {
		fields: [sessions.userId],
		references: [users.id],
	}),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
	users: one(users, {
		fields: [accounts.userId],
		references: [users.id],
	}),
}));
