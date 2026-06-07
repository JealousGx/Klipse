import "@tanstack/react-start/server-only"

import { isProviderHttpError } from "./provider-http-error.server"
import { resolveLongCooldownUntil } from "./provider-quota-reset-parse.server"

function looksLikeQuotaOrBillingExhausted(bodyLower: string): boolean {
	if (bodyLower.includes("resource_exhausted")) {
		return true
	}
	if (bodyLower.includes("quota") && bodyLower.includes("exceed")) {
		return true
	}
	if (bodyLower.includes("billing")) {
		return true
	}
	if (bodyLower.includes("insufficient_quota")) {
		return true
	}
	if (bodyLower.includes("free_tier") && bodyLower.includes("limit")) {
		return true
	}
	if (bodyLower.includes("monthly") && bodyLower.includes("limit")) {
		return true
	}
	return false
}

function errorTypeLabel(status: number): string | null {
	if (status === 429) {
		return "rate_limit"
	}
	if (status === 401 || status === 403) {
		return "auth_error"
	}
	if (status === 408) {
		return "timeout"
	}
	if (status === 503) {
		return "unavailable"
	}
	if (status >= 500 && status < 600) {
		return "server_error"
	}
	return "other"
}

/** Short cooldown so other requests skip this key briefly; same-request rotation still runs. */
function transientCooldownMs(status: number): number {
	if (status === 429) {
		return 90_000
	}
	if (status === 503 || status === 408) {
		return 45_000
	}
	if (status >= 500 && status < 600) {
		return 15_000
	}
	if (status === 401 || status === 403) {
		return 120_000
	}
	return 10_000
}

export type ClassifiedProviderFailure =
	| {
			rotate: true
			cooldownUntil: Date
			errorType: string | null
			/** When true, persist `cooldownUntil` to `quota_reset_at` (long / quota semantics). */
			persistQuotaResetAt: boolean
	  }
	| { rotate: false }

/**
 * Transient → short `cooldown_until`. Long quota/auth → provider-parsed reset, else
 * `quota_reset_at` row, else next UTC month. `persistQuotaResetAt` only for long resets.
 */
export function classifyProviderHttpFailure(
	e: unknown,
	credential: { quotaResetAt: Date | null },
): ClassifiedProviderFailure {
	if (!isProviderHttpError(e)) {
		return { rotate: false }
	}

	const status = e.status
	const bodyLower = e.bodySnippet.toLowerCase()

	const canRotate =
		status === 429 ||
		status === 408 ||
		status === 503 ||
		status === 401 ||
		status === 402 ||
		status === 403 ||
		(status >= 500 && status < 600)

	if (!canRotate) {
		return { rotate: false }
	}

	const longBoundary = resolveLongCooldownUntil(e, credential.quotaResetAt)

	if (status === 401) {
		return {
			rotate: true,
			cooldownUntil: longBoundary,
			errorType: "auth_error",
			persistQuotaResetAt: true,
		}
	}
	if (status === 402) {
		return {
			rotate: true,
			cooldownUntil: longBoundary,
			errorType: "payment_required",
			persistQuotaResetAt: true,
		}
	}
	if (
		(status === 429 || status === 403) &&
		looksLikeQuotaOrBillingExhausted(bodyLower)
	) {
		return {
			rotate: true,
			cooldownUntil: longBoundary,
			errorType: "quota_exhausted",
			persistQuotaResetAt: true,
		}
	}
	if (status === 403) {
		return {
			rotate: true,
			cooldownUntil: new Date(Date.now() + transientCooldownMs(403)),
			errorType: "forbidden",
			persistQuotaResetAt: false,
		}
	}

	const ms = transientCooldownMs(status)
	return {
		rotate: true,
		cooldownUntil: new Date(Date.now() + ms),
		errorType: errorTypeLabel(status),
		persistQuotaResetAt: false,
	}
}
