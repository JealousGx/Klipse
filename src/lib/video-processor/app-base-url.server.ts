import "@tanstack/react-start/server-only"

import { env } from "@/env"

/**
 * Canonical HTTPS origin for video-processor webhooks (no trailing slash).
 *
 * `VIDEO_PROCESSOR_CALLBACK_URL` takes priority when set — scoped ONLY to this path,
 * for local dev against a real deployed processor via a tunnel (ngrok/Cloudflare
 * Tunnel/etc.) without redirecting TikTok OAuth or anything else through the tunnel too.
 */
export function getAppPublicBaseUrl(): string {
	const raw = (
		env.VIDEO_PROCESSOR_CALLBACK_URL ??
		env.APP_PUBLIC_URL ??
		env.SERVER_URL
	)?.trim()
	if (!raw) {
		throw new Error(
			"Set VIDEO_PROCESSOR_CALLBACK_URL, APP_PUBLIC_URL, or SERVER_URL for the processor to call back",
		)
	}
	return raw.replace(/\/$/, "")
}
