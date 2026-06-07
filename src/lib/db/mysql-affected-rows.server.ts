import "@tanstack/react-start/server-only"

/** Drizzle / mysql2 tuple, or a plain object from another MySQL-compatible driver. */
const ROW_COUNT_KEYS = [
	"rowsAffected",
	"affectedRows",
	"rows_affected",
	"rowCount",
	"changes",
	"changedRows",
] as const

function coerceToNonNegativeInt(value: unknown): number | undefined {
	if (typeof value === "number" && Number.isFinite(value)) {
		return Math.max(0, Math.trunc(value))
	}
	if (typeof value === "bigint") {
		return Number(value >= 0n ? value : 0n)
	}
	if (typeof value === "string" && /^\d+$/.test(value)) {
		return Math.max(0, Number.parseInt(value, 10))
	}
	return undefined
}

function pickRowCount(o: object): number | undefined {
	const r = o as Record<string, unknown>
	for (const key of ROW_COUNT_KEYS) {
		if (!(key in r)) {
			continue
		}
		const n = coerceToNonNegativeInt(r[key])
		if (n !== undefined) {
			return n
		}
	}
	return undefined
}

/** Best-effort row count from an UPDATE/DELETE execute result (shape varies by driver). */
export function mysqlAffectedRowsFromUpdateResult(result: unknown): number {
	if (result == null) {
		return 0
	}

	if (Array.isArray(result) && result[0] && typeof result[0] === "object") {
		const n = pickRowCount(result[0] as object)
		if (n !== undefined) {
			return n
		}
	}

	if (typeof result === "object" && !Array.isArray(result)) {
		const n = pickRowCount(result)
		if (n !== undefined) {
			return n
		}
	}

	return 0
}
