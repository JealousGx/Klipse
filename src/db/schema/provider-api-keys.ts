import { sql } from "drizzle-orm"
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
} from "drizzle-orm/mysql-core"

/** Which upstream API the secret authenticates to. */
export const providerApiKeyProviderEnum = mysqlEnum("provider", [
	// Active providers
	"openrouter", // script (models[] array) + images (FLUX.2)
	"google_tts", // TTS primary (1M chars/month free)
	"replicate", // image fallback (FLUX Schnell $0.003/img)
	"unreal_speech", // TTS fallback (250K chars/month free)
	"elevenlabs", // sound effects (Creator+)
	// Legacy — kept for DB enum compat, no longer used in new code
	"gemini",
	"pollinations",
	// Reserved for future
	"openai",
	"kling",
	"luma",
])

/**
 * Which pipeline task(s) this key is authorised for.
 * `any` = no restriction (default for backward-compat).
 */
export const providerApiKeyTaskEnum = mysqlEnum("task_type", [
	"any",
	"script",
	"image",
	"tts",
	"voice",
	"sound",
])

export type ProviderApiKeyTask =
	| "any"
	| "script"
	| "image"
	| "tts"
	| "voice"
	| "sound"

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
		/**
		 * Optional model ID to use with this specific key, overriding the global env default.
		 * e.g. `gemini-2.5-flash`, `nvidia/nemotron-3-super:free`, `en-US-Chirp-HD-F`.
		 */
		modelId: varchar("model_id", { length: 255 }),
		/**
		 * Which pipeline task this key may be used for. `any` means no restriction.
		 * Allows splitting a key pool: e.g. some Gemini keys only for `script`, others for `image`.
		 */
		taskType: providerApiKeyTaskEnum.default("any").notNull(),
		/** Admin-friendly label / note (e.g. "personal key — 1000 RPD quota"). */
		label: varchar("label", { length: 128 }),
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
)

export type ProviderApiKeyRow = typeof providerApiKeys.$inferSelect
