/**
 * Sentry helpers for Klipse main app.
 *
 * Server init: handled by `instrument.server.mjs` loaded via `--import` flag.
 * Client init: called once in `router.tsx` via `initSentryClient(router)`.
 *
 * Both are no-ops when VITE_APP_SENTRY_DSN is absent — safe in local dev.
 */
import * as Sentry from "@sentry/tanstackstart-react"

import { env } from "@/env"

// ─── Client init ─────────────────────────────────────────────────────────────

let clientInitialised = false

export function initSentryClient(
	router?: Parameters<typeof Sentry.tanstackRouterBrowserTracingIntegration>[0],
): void {
	if (clientInitialised) return
	const dsn = env.VITE_APP_SENTRY_DSN
	if (!dsn) return

	const integrations = [Sentry.replayIntegration()]

	clientInitialised = true
	Sentry.init({
		dsn,
		environment: env.VITE_APP_URL?.includes("localhost")
			? "development"
			: "production",
		integrations: router
			? [
					Sentry.tanstackRouterBrowserTracingIntegration(router),
					...integrations,
				]
			: integrations,
		tracesSampleRate: 0.05,
		replaysSessionSampleRate: 0.4, // Record 40% of sessions for replay in production (higher than normal to get more data on user interactions leading to errors)
		replaysOnErrorSampleRate: 1,
		sendDefaultPii: true,
		enableLogs: true,
	})
}

// ─── Error capture ────────────────────────────────────────────────────────────

/** Capture an error with optional context. Never throws. */
export function captureException(
	err: unknown,
	ctx?: Record<string, unknown>,
): void {
	try {
		Sentry.withScope((scope) => {
			if (ctx) scope.setExtras(ctx)
			Sentry.captureException(err)
		})
	} catch {
		// Never throw from observability code
	}
}
