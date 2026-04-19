/**
 * Structured JSON-line logger for the main app.
 *
 * Designed to run in both Node.js (dev) and Cloudflare Workers (prod).
 * No `node:` imports — uses only global APIs.
 *
 * Log levels and when they emit:
 *   error / warn  → ALWAYS (never filtered)
 *   info          → when KLIPSE_PERF_LOG=1 OR non-production environment
 *   debug         → development only
 *
 * Output: one JSON line per call — easy to grep locally and parse in Axiom.
 *
 * Fields in every log line:
 *   level, message, service, env, t (unix ms), _time (ISO), + any context fields passed
 *
 * Production delivery:
 *   Logs flow via CF Observability Logs → Axiom OTLP destination (main-app-logs).
 *   No direct Axiom fetch — CF kills pending fetches post-response without waitUntil.
 *   Configure in wrangler.jsonc observability.logs.destinations + CF dashboard destination.
 *
 * Usage:
 *   import { logger } from "@/lib/logger";
 *   logger.info("job_created", { jobId, userId });
 *   logger.error("webhook_failed", { jobId, status: 500 });
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
	/** Authenticated user ID */
	userId?: string;
	/** Video generation job ID */
	jobId?: string;
	/** Trace / correlation ID for a request */
	requestId?: string;
	/** HTTP status code */
	status?: number;
	/** Duration in milliseconds */
	durationMs?: number;
	/** Arbitrary extra fields */
	[key: string]: unknown;
}

function getEnv(): string {
	try {
		return (
			(typeof process !== "undefined" && process.env?.ENVIRONMENT) ||
			(typeof process !== "undefined" && process.env?.NODE_ENV) ||
			"unknown"
		);
	} catch {
		return "unknown";
	}
}

function shouldLog(level: LogLevel): boolean {
	if (level === "error" || level === "warn") return true;
	try {
		const perfLog =
			typeof process !== "undefined" && process.env?.KLIPSE_PERF_LOG === "1";
		const nodeEnv =
			typeof process !== "undefined" ? process.env?.NODE_ENV : undefined;
		const isNonProd = nodeEnv !== "production";
		if (level === "info") return perfLog || isNonProd;
		return nodeEnv === "development";
	} catch {
		return false;
	}
}

function emit(level: LogLevel, message: string, ctx?: LogContext): void {
	if (!shouldLog(level)) return;
	try {
		const now = Date.now();
		const fields = {
			level,
			message,
			service: "klipse-main",
			env: getEnv(),
			t: now,
			// Axiom uses _time for event timestamp ordering
			_time: new Date(now).toISOString(),
			...ctx,
		};
		const line = JSON.stringify(fields);
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

export const logger = {
	debug: (message: string, ctx?: LogContext) => emit("debug", message, ctx),
	info: (message: string, ctx?: LogContext) => emit("info", message, ctx),
	warn: (message: string, ctx?: LogContext) => emit("warn", message, ctx),
	error: (message: string, ctx?: LogContext) => emit("error", message, ctx),
} as const;
