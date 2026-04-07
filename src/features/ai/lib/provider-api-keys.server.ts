import "@tanstack/react-start/server-only";

import { and, asc, count, eq } from "drizzle-orm";

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

/**
 * Enabled keys for the provider, ordered. Env keys are materialized into the table first
 * when there are no rows for that provider.
 */
export async function listProviderApiKeyCredentials(
	provider: AiProviderKind,
): Promise<ProviderApiKeyCredential[]> {
	await ensureEnvProviderKeysMaterialized(provider);

	const rows = await getDb()
		.select({
			id: providerApiKeys.id,
			secret: providerApiKeys.secret,
			quotaResetAt: providerApiKeys.quotaResetAt,
		})
		.from(providerApiKeys)
		.where(
			and(
				eq(providerApiKeys.provider, provider),
				eq(providerApiKeys.disabled, false),
			),
		)
		.orderBy(asc(providerApiKeys.sortOrder), asc(providerApiKeys.id));

	return rows.map((r) => ({
		id: r.id,
		secret: r.secret.trim(),
		quotaResetAt: r.quotaResetAt ?? null,
	}));
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
