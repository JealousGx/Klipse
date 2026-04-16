/**
 * Sentry initialisation for the external video processor (Node.js / Cloud Run).
 * No-op when SENTRY_DSN is absent.
 */
import * as Sentry from "@sentry/node";

let initialised = false;

export function initSentry(): void {
	if (initialised) return;
	const dsn = process.env.SENTRY_DSN?.trim();
	if (!dsn) return;

	initialised = true;
	Sentry.init({
		dsn,
		environment: process.env.NODE_ENV ?? "unknown",
		tracesSampleRate: 0.1,
		sendDefaultPii: false,
		enableLogs: true,
	});
}

/** Capture an error with optional context. Never throws. */
export function captureException(
	err: unknown,
	ctx?: Record<string, unknown>,
): void {
	try {
		Sentry.withScope((scope) => {
			if (ctx) scope.setExtras(ctx);
			Sentry.captureException(err);
		});
	} catch {
		// Never throw from observability code
	}
}
