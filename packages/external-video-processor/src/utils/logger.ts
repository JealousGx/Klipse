/**
 * Structured JSON-line logger for the external video processor.
 * Mirrors src/lib/perf-timing.ts (main app) but uses Date.now() for compatibility
 * in Docker/Cloud Run without depending on node:perf_hooks precision overhead.
 *
 * Output format: { type, tag, event, ms?, ...fields }
 * Enable in production with KLIPSE_PERF_LOG=1; always on in development.
 */

const LOG_TYPE = "klipse.perf";

function perfEnabled(): boolean {
	if (typeof process === "undefined" || !process.env) return false;
	return (
		process.env.KLIPSE_PERF_LOG === "1" || process.env.NODE_ENV !== "production"
	);
}

export type LogFields = Record<string, unknown>;

/** Emit one structured JSON line. Never throws. */
export function logEvent(tag: string, event: string, fields?: LogFields): void {
	if (!perfEnabled()) return;
	try {
		console.log(
			JSON.stringify({ type: LOG_TYPE, tag, event, t: Date.now(), ...fields }),
		);
	} catch {}
}

/** Emit a structured line including elapsed ms. Never throws. */
export function logTiming(
	tag: string,
	event: string,
	ms: number,
	fields?: LogFields,
): void {
	if (!perfEnabled()) return;
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
		);
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
	if (!perfEnabled()) return fn();

	logEvent(tag, `${event}.start`, fields);
	const start = Date.now();
	try {
		const result = await fn();
		logTiming(tag, `${event}.done`, Date.now() - start, {
			...fields,
			ok: true,
		});
		return result;
	} catch (e) {
		logTiming(tag, `${event}.error`, Date.now() - start, {
			...fields,
			ok: false,
			error: e instanceof Error ? e.message.slice(0, 200) : String(e),
		});
		throw e;
	}
}
