import { sql } from "drizzle-orm";
import {
	boolean,
	index,
	int,
	mysqlEnum,
	mysqlTable,
	text,
	timestamp,
	uniqueIndex,
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
 * API keys per provider: manually inserted or **materialized from env** when a provider
 * has no rows (see `ensureEnvProviderKeysMaterialized`). Runtime state (cooldown, counts)
 * lives only here (FEATURE_DOC §2.4).
 */
export const providerApiKeys = mysqlTable(
	"provider_api_keys",
	{
		id: varchar("id", { length: 64 }).primaryKey(),
		provider: providerApiKeyProviderEnum.notNull(),
		/** SHA-256 hex of `secret`; unique per `provider` (matches Node `secretFingerprint`). */
		secretFingerprint: varchar("secret_fingerprint", { length: 64 }).notNull(),
		/** Raw secret (treat DB access as sensitive; restrict who can read this table). */
		secret: text("secret").notNull(),
		sortOrder: int("sort_order").default(0).notNull(),
		disabled: boolean("disabled").default(false).notNull(),
		/** Until this time the key is treated as cooling down (FEATURE_DOC §2.4). */
		cooldownUntil: timestamp("cooldown_until", { fsp: 3 }),
		lastFailureAt: timestamp("last_failure_at", { fsp: 3 }),
		failureCount: int("failure_count").default(0).notNull(),
		/** e.g. `rate_limit`, `auth_error` — last failure category. */
		errorType: varchar("error_type", { length: 32 }),
		ownerEmail: varchar("owner_email", { length: 255 }),
		/**
		 * Next known quota reset (UTC): from provider error/`Retry-After`, admin, or last
		 * long cooldown write. Used when the live response does not include a reset time.
		 */
		quotaResetAt: timestamp("quota_reset_at", { fsp: 3 }),
		createdAt: timestamp("created_at", { fsp: 3 })
			.default(sql`CURRENT_TIMESTAMP(3)`)
			.notNull(),
		updatedAt: timestamp("updated_at", { fsp: 3 })
			.default(sql`CURRENT_TIMESTAMP(3)`)
			.notNull(),
	},
	(table) => [
		index("provider_api_keys_provider_idx").on(table.provider, table.disabled),
		uniqueIndex("provider_api_keys_provider_fp_uidx").on(
			table.provider,
			table.secretFingerprint,
		),
	],
);

export type ProviderApiKeyRow = typeof providerApiKeys.$inferSelect;
