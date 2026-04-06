import { sql } from "drizzle-orm";
import {
	boolean,
	index,
	int,
	mysqlEnum,
	mysqlTable,
	text,
	timestamp,
	varchar,
} from "drizzle-orm/mysql-core";

/** Which upstream API the secret authenticates to. */
export const providerApiKeyProviderEnum = mysqlEnum("provider", [
	"gemini",
	"google_tts",
	"pollinations",
	"openai",
	"kling",
	"luma",
]);

/**
 * Optional DB-backed API keys for AI providers. When at least one **enabled** row exists
 * for a provider, those keys are used (ordered by `sort_order`, then `id`). Otherwise
 * the app falls back to the corresponding env vars (see `provider-api-keys.server.ts`).
 */
export const providerApiKeys = mysqlTable(
	"provider_api_keys",
	{
		id: varchar("id", { length: 64 }).primaryKey(),
		provider: providerApiKeyProviderEnum.notNull(),
		/** Raw secret (treat DB access as sensitive; restrict who can read this table). */
		secret: text("secret").notNull(),
		sortOrder: int("sort_order").default(0).notNull(),
		disabled: boolean("disabled").default(false).notNull(),
		createdAt: timestamp("created_at", { fsp: 3 })
			.default(sql`CURRENT_TIMESTAMP(3)`)
			.notNull(),
		updatedAt: timestamp("updated_at", { fsp: 3 })
			.default(sql`CURRENT_TIMESTAMP(3)`)
			.notNull(),
	},
	(table) => [
		index("provider_api_keys_provider_idx").on(table.provider, table.disabled),
	],
);

export type ProviderApiKeyRow = typeof providerApiKeys.$inferSelect;
