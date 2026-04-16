/**
 * Structured JSON-line logger for the Cloudflare Worker queue consumer.
 *
 * CF Workers runtime: no `process.env`, no Node.js APIs.
 * All output via console.* — captured by Wrangler locally and CF Workers
 * Logpush / Log Drain in production.
 *
 * error/warn → always emits
 * info/debug → only in non-production (Wrangler dev)
 */

export interface LogContext {
	/** Queue message job ID */
	jobId?: string;
	/** CF queue name */
	queue?: string;
	/** HTTP status code */
	status?: number;
	/** Arbitrary extra fields */
	[key: string]: unknown;
}

type LogLevel = "debug" | "info" | "warn" | "error";

/** Pass `env.ENVIRONMENT` if available to gate verbose logs correctly. */
function shouldLog(level: LogLevel, environment?: string): boolean {
	if (level === "error" || level === "warn") return true;
	// In prod CF environment, suppress info/debug unless explicitly enabled
	if (environment === "production") return false;
	return true;
}

function emit(
	level: LogLevel,
	message: string,
	ctx?: LogContext,
	environment?: string,
): void {
	if (!shouldLog(level, environment)) return;
	try {
		const line = JSON.stringify({
			level,
			message,
			service: "klipse-worker",
			env: environment ?? "unknown",
			t: Date.now(),
			...ctx,
		});
		if (level === "error") {
			console.error(line);
		} else if (level === "warn") {
			console.warn(line);
		} else {
			console.log(line);
		}
	} catch {
		// Never throw from logger
	}
}

/**
 * Create a logger bound to the current Worker invocation environment.
 *
 * Usage:
 *   const log = createLogger(env);
 *   log.error("Queue message failed", { jobId, queue: batch.queue });
 */
export function createLogger(environment?: string) {
	return {
		debug: (message: string, ctx?: LogContext) =>
			emit("debug", message, ctx, environment),
		info: (message: string, ctx?: LogContext) =>
			emit("info", message, ctx, environment),
		warn: (message: string, ctx?: LogContext) =>
			emit("warn", message, ctx, environment),
		error: (message: string, ctx?: LogContext) =>
			emit("error", message, ctx, environment),
	} as const;
}
