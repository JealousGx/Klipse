/**
 * Structured JSON-line logger for the external video processor.
 *
 * Two concerns, one file:
 *
 * 1. Application-level logging (`logger.*`) — structured JSON, always emits
 *    error/warn, gates info/debug on KLIPSE_PERF_LOG or NODE_ENV.
 *    GCP Cloud Logging captures stdout/stderr automatically on Cloud Run.
 *
 * 2. Performance timing (`logEvent`, `logTiming`, `withTiming`) — perf-gated
 *    JSON lines for pipeline stage instrumentation. Kept for backward compat.
 *
 * Output: one JSON line per call — easy to grep locally, parses in Axiom.
 */

// ─── Level-based logger ─────────────────────────────────────────────────────

export type LogLevel = "debug" | "info" | "warn" | "error"

export interface LogContext {
	/** Video generation job ID */
	jobId?: string
	/** Stage name (script / prepare / assemble) */
	stage?: string
	/** Duration in milliseconds */
	durationMs?: number
	/** HTTP status code */
	status?: number
	/** Arbitrary extra fields */
	[key: string]: unknown
}

// ─── Axiom log drain ────────────────────────────────────────────────────────

interface AxiomConfig {
	token: string
	dataset: string
}

function getAxiomConfig(): AxiomConfig | null {
	const token = process.env.AXIOM_API_TOKEN
	if (!token) return null
	return { token, dataset: process.env.AXIOM_DATASET || "klipse" }
}

const _axiomQueue: object[] = []
let _axiomFlushPending = false

function enqueueAxiom(event: object, config: AxiomConfig): void {
	_axiomQueue.push(event)
	if (_axiomFlushPending) return
	_axiomFlushPending = true
	Promise.resolve().then(() => {
		const batch = _axiomQueue.splice(0)
		_axiomFlushPending = false
		if (!batch.length) return
		fetch(`https://api.axiom.co/v1/datasets/${config.dataset}/ingest`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${config.token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(batch),
		}).catch(() => {})
	})
}

// ─── Level-based logger ─────────────────────────────────────────────────────

function shouldLog(level: LogLevel): boolean {
	if (level === "error" || level === "warn") return true
	const perfLog = process.env.KLIPSE_PERF_LOG === "1"
	const isDev = process.env.NODE_ENV !== "production"
	if (level === "info") return perfLog || isDev
	return process.env.NODE_ENV === "development"
}

function emitLevel(level: LogLevel, message: string, ctx?: LogContext): void {
	if (!shouldLog(level)) return
	try {
		const now = Date.now()
		const fields = {
			level,
			message,
			service: "klipse-processor",
			env: process.env.NODE_ENV ?? "unknown",
			t: now,
			_time: new Date(now).toISOString(),
			...ctx,
		}
		const line = JSON.stringify(fields)
		if (level === "error") {
			console.error(line)
		} else if (level === "warn") {
			console.warn(line)
		} else {
			console.log(line)
		}
		const axiom = getAxiomConfig()
		if (axiom) enqueueAxiom(fields, axiom)
	} catch {
		// Never throw from logger
	}
}

export const logger = {
	debug: (message: string, ctx?: LogContext) =>
		emitLevel("debug", message, ctx),
	info: (message: string, ctx?: LogContext) => emitLevel("info", message, ctx),
	warn: (message: string, ctx?: LogContext) => emitLevel("warn", message, ctx),
	error: (message: string, ctx?: LogContext) =>
		emitLevel("error", message, ctx),
} as const

// ─── Legacy perf-timing API (kept for backward compat) ─────────────────────

const LOG_TYPE = "klipse.perf"

function perfEnabled(): boolean {
	if (typeof process === "undefined" || !process.env) return false
	return (
		process.env.KLIPSE_PERF_LOG === "1" || process.env.NODE_ENV !== "production"
	)
}

export type LogFields = Record<string, unknown>

/** Emit one structured JSON line. Never throws. */
export function logEvent(tag: string, event: string, fields?: LogFields): void {
	if (!perfEnabled()) return
	try {
		console.log(
			JSON.stringify({ type: LOG_TYPE, tag, event, t: Date.now(), ...fields }),
		)
	} catch {}
}

/** Emit a structured line including elapsed ms. Never throws. */
export function logTiming(
	tag: string,
	event: string,
	ms: number,
	fields?: LogFields,
): void {
	if (!perfEnabled()) return
	try {
		console.log(
			JSON.stringify({
				type: LOG_TYPE,
				tag,
				event,
				ms: Math.round(ms),
				t: Date.now(),
				...fields,
			}),
		)
	} catch {}
}

/**
 * Times an async operation and emits two events:
 * - `${event}.start` before
 * - `${event}.done` / `${event}.error` after, with elapsed ms
 *
 * Always rethrows errors — timing is purely observational.
 */
export async function withTiming<T>(
	tag: string,
	event: string,
	fn: () => Promise<T>,
	fields?: LogFields,
): Promise<T> {
	if (!perfEnabled()) return fn()

	logEvent(tag, `${event}.start`, fields)
	const start = Date.now()
	try {
		const result = await fn()
		logTiming(tag, `${event}.done`, Date.now() - start, {
			...fields,
			ok: true,
		})
		return result
	} catch (e) {
		logTiming(tag, `${event}.error`, Date.now() - start, {
			...fields,
			ok: false,
			error: e instanceof Error ? e.message.slice(0, 200) : String(e),
		})
		throw e
	}
}
