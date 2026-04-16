import * as Sentry from "@sentry/tanstackstart-react";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
	Sentry.init({
		dsn,
		environment: process.env.ENVIRONMENT ?? process.env.NODE_ENV ?? "unknown",
		tracesSampleRate: 0.1,
		sendDefaultPii: false,
		enableLogs: true,
	});
}
