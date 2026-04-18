/**
 * Structured JSON-line logger for the main app.
 *
 * Designed to run in both Node.js (dev) and Cloudflare Workers (prod).
 * No `node:` imports — uses only global APIs.
 *
 * Log levels and when they emit:
 *   error / warn  → ALWAYS (never filtered — always ship to log drain)
 *   info          → when KLIPSE_PERF_LOG=1 OR non-production environment
 *   debug         → development only
 *
 * Output: one JSON line per call — easy to grep locally and parse in Axiom.
 *
 * Fields in every log line:
 *   level, message, service, env, t (unix ms), + any context fields passed
 *
 * Axiom shipping:
 *   Set AXIOM_API_TOKEN + AXIOM_DATASET env vars.
 *   error + warn always shipped. info/debug only when shouldLog passes.
 *   Fire-and-forget via fetch — never blocks the response.
 *
 * Usage:
 *   import { logger } from "@/lib/logger";
 *   logger.info("Video job queued", { jobId, userId });
 *   logger.error("Webhook failed", { jobId, status, body });
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

interface AxiomConfig {
	token: string;
	dataset: string;
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

function getAxiomConfig(): AxiomConfig | null {
	try {
		const token =
			typeof process !== "undefined" ? process.env?.AXIOM_API_TOKEN : undefined;
		if (!token) return null;
		const dataset =
			(typeof process !== "undefined" && process.env?.AXIOM_DATASET) ||
			"klipse";
		return { token, dataset };
	} catch {
		return null;
	}
}

// Module-level Axiom send queue — batches events flushed via microtask.
const _axiomQueue: object[] = [];
let _axiomFlushPending = false;

function enqueueAxiom(event: object, config: AxiomConfig): void {
	_axiomQueue.push(event);
	if (_axiomFlushPending) return;
	_axiomFlushPending = true;
	// Flush after current synchronous block — batches rapid log calls.
	Promise.resolve().then(() => {
		const batch = _axiomQueue.splice(0);
		_axiomFlushPending = false;
		if (!batch.length) return;
		fetch(`https://api.axiom.co/v1/datasets/${config.dataset}/ingest`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${config.token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(batch),
		}).catch(() => {
			// Never throw from log drain
		});
	});
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
		// Ship to Axiom if configured
		const axiom = getAxiomConfig();
		if (axiom) {
			enqueueAxiom(fields, axiom);
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
