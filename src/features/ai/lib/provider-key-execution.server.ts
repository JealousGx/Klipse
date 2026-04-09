import "@tanstack/react-start/server-only";

import type { ProviderApiKeyTask } from "@/db/schema/provider-api-keys";

import { RoundRobinPool } from "./api-key-pool.server";
import {
	clearCooldownAfterSuccessfulUse,
	recordProviderKeyFailure,
} from "./provider-api-key-state.server";
import {
	type AiProviderKind,
	listProviderApiKeyCredentials,
	type ProviderApiKeyCredential,
} from "./provider-api-keys.server";
import { parseRetryAfterHeader } from "./provider-quota-reset-parse.server";
import { ProviderHttpError } from "./provider-http-error.server";
import { classifyProviderHttpFailure } from "./provider-key-failure-classify.server";

function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}

/**
 * FEATURE_DOC §2.4: round-robin, try next key on classifiable HTTP failures, persist
 * cooldown only on failure (transient short vs quota/auth until next calendar month UTC).
 *
 * `executeOne` receives the full credential so providers can read `modelId` and use it
 * as a per-key model override instead of (or in addition to) the global env default.
 */
export async function executeWithProviderKeyRotation<T>(
	provider: AiProviderKind,
	executeOne: (credential: ProviderApiKeyCredential) => Promise<T>,
	options?: { providerLabel?: string; taskType?: ProviderApiKeyTask },
): Promise<T> {
	const label = options?.providerLabel ?? provider;
	const credentials = await listProviderApiKeyCredentials(
		provider,
		options?.taskType,
	);
	if (credentials.length === 0) {
		throw new Error(`${label}_no_api_keys`);
	}

	const pool = new RoundRobinPool(credentials);
	const ordered: ProviderApiKeyCredential[] = [];
	for (let i = 0; i < credentials.length; i++) {
		const c = pool.next();
		if (c) ordered.push(c);
	}

	let lastError: unknown;
	for (let i = 0; i < ordered.length; i++) {
		const credential = ordered[i];
		if (!credential) continue;

		// Cooldown filtering is done at DB query level in listProviderApiKeyCredentials.
		const backoffMs = Math.min(100 * 2 ** i, 8000);
		if (backoffMs > 0) await sleep(backoffMs);

		try {
			const result = await executeOne(credential);
			await clearCooldownAfterSuccessfulUse(credential);
			return result;
		} catch (e) {
			lastError = e;
			const classified = classifyProviderHttpFailure(e, {
				quotaResetAt: credential.quotaResetAt,
			});
			if (classified.rotate) {
				await recordProviderKeyFailure(credential, {
					cooldownUntil: classified.cooldownUntil,
					errorType: classified.errorType,
					persistQuotaResetAt: classified.persistQuotaResetAt,
				});
				continue;
			}
			throw e;
		}
	}

	if (lastError instanceof Error) throw lastError;
	throw new Error(`${label}_all_keys_exhausted`);
}

export function throwProviderHttpError(
	providerLabel: string,
	status: number,
	bodyText: string,
	retryAfterHeader?: string | null,
): never {
	const retryAfterAt = parseRetryAfterHeader(retryAfterHeader);
	throw new ProviderHttpError(
		status,
		bodyText.slice(0, 800),
		providerLabel,
		undefined,
		retryAfterAt ?? undefined,
	);
}
