import { performance } from "node:perf_hooks";

/** JSON lines — easy to grep locally or ship to Axiom / log drains later. */
const LOG_TYPE = "klipse.perf";

function perfEnabled(): boolean {
	if (typeof process === "undefined" || !process.env) return false;
	return (
		process.env.KLIPSE_PERF_LOG === "1" ||
		process.env.NODE_ENV === "development"
	);
}

function nowMs(): number {
	return performance.now();
}

export type PerfFields = Record<string, unknown>;

/**
 * Emits one JSON object per line: `{ type, event, ms, ...fields }`.
 * Enable in production with `KLIPSE_PERF_LOG=1`; on by default in development.
 */
export function logPerfEvent(
	event: string,
	ms: number,
	fields: PerfFields | undefined,
): void {
	if (!perfEnabled()) return;
	const line = JSON.stringify({
		type: LOG_TYPE,
		event,
		ms: Math.round(ms * 100) / 100,
		...fields,
	});
	console.log(line);
}

export async function withPerfTiming<T>(
	event: string,
	fields: PerfFields | undefined,
	fn: () => Promise<T>,
): Promise<T> {
	if (!perfEnabled()) {
		return fn();
	}
	const start = nowMs();
	try {
		const result = await fn();
		logPerfEvent(event, nowMs() - start, { ...fields, ok: true });
		return result;
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		logPerfEvent(event, nowMs() - start, {
			...fields,
			ok: false,
			error: message,
		});
		throw err;
	}
}
