/** FEATURE_DOC §2.7–2.8 — free vs paid default storage TTL before purge. */
export const FREE_TIER_RETENTION_HOURS = 24
export const PAID_TIER_RETENTION_HOURS = 24 * 7

/** Human-readable retention window for copy (e.g. "7 days", "24 hours"). */
export function humanizeRetentionHours(hours: number): string {
	if (hours === 24) {
		return "24 hours"
	}
	if (hours % 24 === 0) {
		const d = hours / 24
		return `${d} day${d === 1 ? "" : "s"}`
	}
	return `${hours} hour${hours === 1 ? "" : "s"}`
}

/**
 * Deadline for stored-output purge — use in emails + Jobs UI.
 * `locale` `undefined` uses the runtime default (browser or server).
 */
export function formatOutputRetentionDeadlineUtc(
	deadline: Date,
	locale?: string,
): string {
	return deadline.toLocaleString(locale, {
		timeZone: "UTC",
		weekday: "long",
		year: "numeric",
		month: "long",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
		timeZoneName: "short",
	})
}
