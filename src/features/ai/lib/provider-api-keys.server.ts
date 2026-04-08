import "@tanstack/react-start/server-only";

import { and, asc, count, eq, isNull, lt, or, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { providerApiKeys } from "@/db/schema/provider-api-keys";
import { env } from "@/env";
import { providerApiKeyRowId } from "@/lib/id";

import { secretFingerprint } from "./provider-key-fingerprint.server";

export type AiProviderKind = "gemini" | "google_tts" | "pollinations";

/** One row in `provider_api_keys` (manually created or materialized from env). */
export type ProviderApiKeyCredential = {
	id: string;
	secret: string;
	/** Next known quota reset (UTC), from DB — used when the error has no reset time. */
	quotaResetAt: Date | null;
};

function parseCommaEnv(raw: string | undefined): string[] {
	return (raw ?? "")
		.split(",")
		.map((k) => k.trim())
		.filter(Boolean);
}

function envFallbackKeys(provider: AiProviderKind): string[] {
	switch (provider) {
		case "gemini":
			return parseCommaEnv(env.GEMINI_API_KEYS);
		case "google_tts":
			return parseCommaEnv(env.GOOGLE_TTS_API_KEYS);
		case "pollinations": {
			const k = env.POLLINATIONS_API_KEY?.trim();
			return k ? [k] : [];
		}
		default: {
			const _exhaustive: never = provider;
			return _exhaustive;
		}
	}
}

/**
 * When a provider has **no** rows yet, insert one row per env key so cooldown/counters
 * stay in `provider_api_keys` only (FEATURE_DOC §2.4).
 */
async function ensureEnvProviderKeysMaterialized(
	provider: AiProviderKind,
): Promise<void> {
	const db = getDb();
	const [row] = await db
		.select({ n: count() })
		.from(providerApiKeys)
		.where(eq(providerApiKeys.provider, provider));

	if (Number(row?.n ?? 0) > 0) {
		return;
	}

	const keys = envFallbackKeys(provider);
	if (keys.length === 0) {
		return;
	}

	const now = new Date();
	for (let i = 0; i < keys.length; i++) {
		const secret = keys[i]?.trim();
		if (!secret) {
			continue;
		}
		const fp = secretFingerprint(secret);
		try {
			await db.insert(providerApiKeys).values({
				id: providerApiKeyRowId(),
				provider,
				secret,
				secretFingerprint: fp,
				sortOrder: i,
				disabled: false,
				failureCount: 0,
				quotaResetAt: null,
				createdAt: now,
				updatedAt: now,
			});
		} catch {
			// Concurrent materialize or duplicate (provider, fingerprint).
		}
	}
}

const KEY_SELECT = {
	id: providerApiKeys.id,
	secret: providerApiKeys.secret,
	quotaResetAt: providerApiKeys.quotaResetAt,
} as const;

const KEY_ORDER = [
	asc(providerApiKeys.sortOrder),
	asc(providerApiKeys.id),
] as const;

function toCredential(r: {
	id: string;
	secret: string;
	quotaResetAt: Date | null;
}): ProviderApiKeyCredential {
	return { id: r.id, secret: r.secret.trim(), quotaResetAt: r.quotaResetAt ?? null };
}

/**
 * Enabled keys for the provider, ordered. Env keys are materialized into the table first
 * when there are no rows for that provider.
 *
 * Two-query pattern to avoid N per-key cooldown roundtrips in the execution loop:
 * 1. Active keys (cooldownUntil IS NULL OR cooldownUntil < NOW()) — return these when any exist.
 * 2. Fallback: all non-disabled keys when everything is cooled down (let them try — they will
 *    fail gracefully and cooldown state will be updated).
 */
export async function listProviderApiKeyCredentials(
	provider: AiProviderKind,
): Promise<ProviderApiKeyCredential[]> {
	await ensureEnvProviderKeysMaterialized(provider);

	const db = getDb();
	const baseWhere = and(
		eq(providerApiKeys.provider, provider),
		eq(providerApiKeys.disabled, false),
	);

	// Query 1: keys not in cooldown.
	const activeRows = await db
		.select(KEY_SELECT)
		.from(providerApiKeys)
		.where(
			and(
				baseWhere,
				or(
					isNull(providerApiKeys.cooldownUntil),
					lt(providerApiKeys.cooldownUntil, sql`NOW(3)`),
				),
			),
		)
		.orderBy(...KEY_ORDER);

	if (activeRows.length > 0) {
		return activeRows.map(toCredential);
	}

	// Query 2: everything is cooled down — return all so we attempt anyway.
	// The execution layer will record the next failure and advance the cooldown window.
	const allRows = await db
		.select(KEY_SELECT)
		.from(providerApiKeys)
		.where(baseWhere)
		.orderBy(...KEY_ORDER);

	return allRows.map(toCredential);
}

/**
 * Secrets only (ordered).
 */
export async function getProviderApiKeys(
	provider: AiProviderKind,
): Promise<string[]> {
	const creds = await listProviderApiKeyCredentials(provider);
	return creds.map((c) => c.secret);
}
