import "@tanstack/react-start/server-only"

import { and, eq, isNotNull, or, sql } from "drizzle-orm"

import { getDb } from "@/db"
import { providerApiKeys } from "@/db/schema/provider-api-keys"
import { logger } from "@/lib/logger"

import type { ProviderApiKeyCredential } from "./provider-api-keys.server"

export async function isProviderKeyInCooldown(
	credential: ProviderApiKeyCredential,
): Promise<boolean> {
	const now = new Date()
	const db = getDb()

	const [row] = await db
		.select({ cooldownUntil: providerApiKeys.cooldownUntil })
		.from(providerApiKeys)
		.where(eq(providerApiKeys.id, credential.id))
		.limit(1)
	const cu = row?.cooldownUntil
	return cu != null && cu > now
}

/**
 * Persist failure: cooldown window, last failure time, failure count, error category.
 * No writes on success except `clearCooldownAfterSuccessfulUse` (optional reset).
 */
export async function recordProviderKeyFailure(
	credential: ProviderApiKeyCredential,
	input: {
		cooldownUntil: Date
		errorType: string | null
		/** Long / quota-class failures: store next reset on the row for later fallbacks. */
		persistQuotaResetAt?: boolean
	},
): Promise<void> {
	const now = new Date()
	const db = getDb()

	await db
		.update(providerApiKeys)
		.set({
			cooldownUntil: input.cooldownUntil,
			lastFailureAt: now,
			failureCount: sql`${providerApiKeys.failureCount} + 1`,
			errorType: input.errorType,
			updatedAt: now,
			...(input.persistQuotaResetAt
				? { quotaResetAt: input.cooldownUntil }
				: {}),
		})
		.where(eq(providerApiKeys.id, credential.id))
	logger.warn("provider_key_cooldown_set", {
		keyId: credential.id,
		provider: credential.provider,
		errorType: input.errorType,
		cooldownUntil: input.cooldownUntil.toISOString(),
	})
}

/**
 * Clears cooldown after a successful upstream call. **No-op** when the row has no
 * cooldown/error (avoids a write on every success).
 */
export async function clearCooldownAfterSuccessfulUse(
	credential: ProviderApiKeyCredential,
): Promise<void> {
	const now = new Date()
	const db = getDb()

	await db
		.update(providerApiKeys)
		.set({
			cooldownUntil: null,
			errorType: null,
			updatedAt: now,
		})
		.where(
			and(
				eq(providerApiKeys.id, credential.id),
				or(
					isNotNull(providerApiKeys.cooldownUntil),
					isNotNull(providerApiKeys.errorType),
				),
			),
		)
	logger.info("provider_key_cooldown_cleared", {
		keyId: credential.id,
		provider: credential.provider,
	})
}
