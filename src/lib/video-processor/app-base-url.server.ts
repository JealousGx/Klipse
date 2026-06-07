import "@tanstack/react-start/server-only"

import { env } from "@/env"

/** Canonical HTTPS origin for webhooks (no trailing slash). */
export function getAppPublicBaseUrl(): string {
	const raw = (env.APP_PUBLIC_URL ?? env.SERVER_URL)?.trim()
	if (!raw) {
		throw new Error(
			"Set APP_PUBLIC_URL or SERVER_URL when using VIDEO_PROCESSOR_URL",
		)
	}
	return raw.replace(/\/$/, "")
}
