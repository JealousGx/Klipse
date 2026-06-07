import "@tanstack/react-start/server-only"

import type { ProviderHttpError } from "./provider-http-error.server"

/** RFC 7231 `Retry-After`: delta-seconds or HTTP-date. */
export function parseRetryAfterHeader(
	raw: string | null | undefined,
): Date | null {
	if (raw == null || raw === "") {
		return null
	}
	const t = raw.trim()
	const seconds = Number(t)
	if (Number.isFinite(seconds) && seconds >= 0) {
		return new Date(Date.now() + seconds * 1000)
	}
	const ms = Date.parse(t)
	if (!Number.isNaN(ms)) {
		return new Date(ms)
	}
	return null
}

/** Parses protobuf-style durations like `39s`, `3.5s`. */
function parseDurationToMs(s: string): number | null {
	const m = /^(\d+(?:\.\d+)?)s$/i.exec(s.trim())
	if (!m?.[1]) {
		return null
	}
	const n = Number(m[1])
	return Number.isFinite(n) ? n * 1000 : null
}

function walkForRetryDelay(o: unknown): string | null {
	if (o == null) {
		return null
	}
	if (typeof o === "object" && !Array.isArray(o)) {
		const r = o as Record<string, unknown>
		if (typeof r.retryDelay === "string") {
			return r.retryDelay
		}
		if (typeof r.retry_delay === "string") {
			return r.retry_delay
		}
		for (const v of Object.values(r)) {
			const w = walkForRetryDelay(v)
			if (w) {
				return w
			}
		}
	}
	if (Array.isArray(o)) {
		for (const v of o) {
			const w = walkForRetryDelay(v)
			if (w) {
				return w
			}
		}
	}
	return null
}

/** Google-style JSON error bodies (`google.rpc.RetryInfo.retryDelay`, etc.). */
function parseRetryDelayFromJsonBody(bodySnippet: string): Date | null {
	try {
		const json = JSON.parse(bodySnippet) as unknown
		const delay = walkForRetryDelay(json)
		if (!delay) {
			return null
		}
		const ms = parseDurationToMs(delay)
		if (ms == null) {
			return null
		}
		return new Date(Date.now() + ms)
	} catch {
		return null
	}
}

/**
 * Best-effort next quota/availability instant from provider response (headers + body).
 */
export function parseQuotaResetFromProviderError(
	e: ProviderHttpError,
): Date | null {
	const now = Date.now()
	if (e.retryAfterAt && e.retryAfterAt.getTime() > now) {
		return e.retryAfterAt
	}
	const fromJson = parseRetryDelayFromJsonBody(e.bodySnippet)
	if (fromJson && fromJson.getTime() > now) {
		return fromJson
	}
	return null
}

/** Fallback when provider does not document a reset time. */
export function startOfNextCalendarMonthUtc(now = new Date()): Date {
	const y = now.getUTCFullYear()
	const m = now.getUTCMonth()
	return new Date(Date.UTC(y, m + 1, 1, 0, 0, 0, 0))
}

/**
 * Long cooldown instant: parsed from error → else stored `quota_reset_at` if still future →
 * else next UTC calendar month.
 */
export function resolveLongCooldownUntil(
	e: ProviderHttpError,
	storedQuotaResetAt: Date | null,
): Date {
	const now = Date.now()
	const parsed = parseQuotaResetFromProviderError(e)
	if (parsed && parsed.getTime() > now) {
		return parsed
	}
	if (storedQuotaResetAt && storedQuotaResetAt.getTime() > now) {
		return storedQuotaResetAt
	}
	return startOfNextCalendarMonthUtc()
}
