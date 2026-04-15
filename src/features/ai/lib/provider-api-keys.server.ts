import "@tanstack/react-start/server-only";

import { and, asc, count, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";

import { getDb } from "@/db";
import {
	type ProviderApiKeyTask,
	providerApiKeys,
} from "@/db/schema/provider-api-keys";
import { env } from "@/env";
import { providerApiKeyRowId } from "@/lib/id";

import { secretFingerprint } from "./provider-key-fingerprint.server";

export type AiProviderKind =
	| "openrouter" // script (LLM) primary
	| "gemini" // script (LLM) fallback — direct Gemini API
	| "google_tts" // TTS primary (1M Neural2 chars/month free)
	| "replicate" // image generation (FLUX Schnell ~$0.003/img)
	| "unreal_speech" // TTS fallback (250K chars/month free)
	| "elevenlabs"; // sound effects (Creator+ only, 10K credits/month free)

/** One row in `provider_api_keys` (manually created or materialized from env). */
export type ProviderApiKeyCredential = {
	id: string;
	secret: string;
	/** Next known quota reset (UTC), from DB — used when the error has no reset time. */
	quotaResetAt: Date | null;
	/**
	 * Per-key model override. When set, providers use this instead of their global
	 * env/default model (e.g. a Gemini key can target `gemini-2.5-flash` specifically).
	 */
	modelId: string | null;
};

function parseCommaEnv(raw: string | undefined): string[] {
	return (raw ?? "")
		.split(",")
		.map((k) => k.trim())
		.filter(Boolean);
}

function envFallbackKeys(provider: AiProviderKind): string[] {
	switch (provider) {
		case "openrouter":
			return parseCommaEnv(env.OPENROUTER_API_KEYS);
		case "gemini":
			return parseCommaEnv(env.GEMINI_API_KEYS);
		case "google_tts":
			return parseCommaEnv(env.GOOGLE_TTS_API_KEYS);
		case "replicate":
			return parseCommaEnv(env.REPLICATE_API_KEYS);
		case "unreal_speech":
			return parseCommaEnv(env.UNREAL_SPEECH_API_KEYS);
		case "elevenlabs":
			return parseCommaEnv(env.ELEVENLABS_API_KEYS);
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
				taskType: "any",
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
	modelId: providerApiKeys.modelId,
} as const;

const KEY_ORDER = [
	asc(providerApiKeys.sortOrder),
	asc(providerApiKeys.id),
] as const;

function toCredential(r: {
	id: string;
	secret: string;
	quotaResetAt: Date | null;
	modelId: string | null;
}): ProviderApiKeyCredential {
	return {
		id: r.id,
		secret: r.secret.trim(),
		quotaResetAt: r.quotaResetAt ?? null,
		modelId: r.modelId ?? null,
	};
}

/**
 * Enabled keys for the provider, ordered. Env keys are materialized into the table first
 * when there are no rows for that provider.
 *
 * Pass `taskType` to restrict to keys whose `task_type` is `any` or the given task — lets
 * admins pin specific keys to specific pipeline stages.
 *
 * Two-query pattern to avoid N per-key cooldown roundtrips in the execution loop:
 * 1. Active keys (cooldownUntil IS NULL OR cooldownUntil < NOW()) — return these when any exist.
 * 2. Fallback: all non-disabled keys when everything is cooled down (let them try — they will
 *    fail gracefully and cooldown state will be updated).
 */
export async function listProviderApiKeyCredentials(
	provider: AiProviderKind,
	taskType?: ProviderApiKeyTask,
): Promise<ProviderApiKeyCredential[]> {
	await ensureEnvProviderKeysMaterialized(provider);

	const db = getDb();
	const taskWhere =
		taskType && taskType !== "any"
			? or(
					eq(providerApiKeys.taskType, "any"),
					eq(providerApiKeys.taskType, taskType),
				)
			: undefined;

	const baseWhere = and(
		eq(providerApiKeys.provider, provider),
		eq(providerApiKeys.disabled, false),
		taskWhere,
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
	const allRows = await db
		.select(KEY_SELECT)
		.from(providerApiKeys)
		.where(baseWhere)
		.orderBy(...KEY_ORDER);

	return allRows.map(toCredential);
}

const PROCESSOR_PROVIDERS: AiProviderKind[] = [
	"openrouter",
	"gemini",
	"google_tts",
	"replicate",
	"unreal_speech",
	"elevenlabs",
];

/**
 * Fetches credentials for all five processor providers in two queries instead of ten:
 * 1. Grouped count → materialize any provider that has no rows yet (env keys → DB).
 * 2. Single bulk SELECT → group by provider client-side, apply active-first logic.
 *
 * Drop-in replacement for five parallel `listProviderApiKeyCredentials()` calls.
 */
export async function listAllProcessorProviderKeyCredentials(): Promise<
	Record<AiProviderKind, ProviderApiKeyCredential[]>
> {
	const db = getDb();

	// Query 1: one grouped count to detect which providers need env materialization.
	const countRows = await db
		.select({ provider: providerApiKeys.provider, n: count() })
		.from(providerApiKeys)
		.where(inArray(providerApiKeys.provider, PROCESSOR_PROVIDERS))
		.groupBy(providerApiKeys.provider);

	const countMap = new Map(
		countRows.map((r) => [r.provider as AiProviderKind, Number(r.n)]),
	);
	const missing = PROCESSOR_PROVIDERS.filter(
		(p) => (countMap.get(p) ?? 0) === 0,
	);
	if (missing.length > 0) {
		await Promise.all(missing.map(ensureEnvProviderKeysMaterialized));
	}

	// Query 2: all non-disabled keys for all providers in one shot.
	const rows = await db
		.select({
			id: providerApiKeys.id,
			secret: providerApiKeys.secret,
			quotaResetAt: providerApiKeys.quotaResetAt,
			modelId: providerApiKeys.modelId,
			provider: providerApiKeys.provider,
			cooldownUntil: providerApiKeys.cooldownUntil,
		})
		.from(providerApiKeys)
		.where(
			and(
				inArray(providerApiKeys.provider, PROCESSOR_PROVIDERS),
				eq(providerApiKeys.disabled, false),
			),
		)
		.orderBy(...KEY_ORDER);

	// Group by provider, then apply active-first logic per group.
	const grouped = new Map<AiProviderKind, typeof rows>(
		PROCESSOR_PROVIDERS.map((p) => [p, []]),
	);
	for (const row of rows) {
		grouped.get(row.provider as AiProviderKind)?.push(row);
	}

	const now = new Date();
	const result = {} as Record<AiProviderKind, ProviderApiKeyCredential[]>;
	for (const provider of PROCESSOR_PROVIDERS) {
		const all = grouped.get(provider) ?? [];
		const active = all.filter(
			(r) => r.cooldownUntil === null || r.cooldownUntil < now,
		);
		result[provider] = (active.length > 0 ? active : all).map(toCredential);
	}
	return result;
}

/**
 * Secrets only (ordered).
 */
export async function getProviderApiKeys(
	provider: AiProviderKind,
	taskType?: ProviderApiKeyTask,
): Promise<string[]> {
	const creds = await listProviderApiKeyCredentials(provider, taskType);
	return creds.map((c) => c.secret);
}
