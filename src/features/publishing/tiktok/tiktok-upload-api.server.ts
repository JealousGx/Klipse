import "@tanstack/react-start/server-only"

import { logger } from "@/lib/logger"

const TIKTOK_API_BASE = "https://open.tiktokapis.com"

/**
 * Preferred privacy level ordering — most public to most private.
 * We pick the first one available in the creator's `privacy_level_options`.
 */
const PRIVACY_PREFERENCE_ORDER = [
	"PUBLIC_TO_EVERYONE",
	"FOLLOWER_OF_CREATOR",
	"MUTUAL_FOLLOW_FRIENDS",
	"SELF_ONLY",
] as const

/**
 * Selects the most public privacy level available for the creator.
 * Falls back to "SELF_ONLY" if options are empty (shouldn't happen).
 */
export function pickBestPrivacyLevel(options: string[]): string {
	for (const level of PRIVACY_PREFERENCE_ORDER) {
		if (options.includes(level)) return level
	}
	return options[0] ?? "SELF_ONLY"
}

export type TiktokInitVideoResult = {
	publishId: string
}

/**
 * Initialises a TikTok direct-post video upload using PULL_FROM_URL.
 * TikTok fetches the video directly from `videoUrl` — no bytes are passed
 * through the main app. Requires the R2 domain to be verified in the TikTok
 * Developer Portal (error: `url_ownership_unverified` if not).
 */
export async function initTiktokVideoUpload(input: {
	accessToken: string
	videoUrl: string
	caption: string
	privacyLevel: string
	commentDisabled: boolean
	duetDisabled: boolean
	stitchDisabled: boolean
	/** Whether the commercial content disclosure toggle is on. */
	disclosureEnabled?: boolean
	/** "Your brand" — promotes yourself (brand_organic_toggle). */
	brandOrganic?: boolean
	/** "Branded content" — promotes a third party (brand_content_toggle). */
	brandedContent?: boolean
}): Promise<TiktokInitVideoResult> {
	const body = {
		post_info: {
			title: input.caption,
			privacy_level: input.privacyLevel,
			disable_comment: input.commentDisabled,
			disable_duet: input.duetDisabled,
			disable_stitch: input.stitchDisabled,
			is_aigc: true,
			brand_content_toggle: input.disclosureEnabled
				? Boolean(input.brandedContent)
				: false,
			brand_organic_toggle: input.disclosureEnabled
				? Boolean(input.brandOrganic)
				: false,
		},
		source_info: {
			source: "PULL_FROM_URL",
			video_url: input.videoUrl,
		},
	}

	const res = await fetch(`${TIKTOK_API_BASE}/v2/post/publish/video/init/`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${input.accessToken}`,
			"Content-Type": "application/json; charset=UTF-8",
		},
		body: JSON.stringify(body),
		signal: AbortSignal.timeout(30_000),
	})

	const json = (await res.json().catch(() => ({}))) as {
		data?: { publish_id?: string }
		error?: { code?: string; message?: string; log_id?: string }
	}

	if (!res.ok || json.error?.code !== "ok") {
		const code = json.error?.code ?? `http_${res.status}`
		const msg = json.error?.message ?? ""
		logger.error("tiktok_video_init_failed", {
			status: res.status,
			code,
			message: msg,
			logId: json.error?.log_id,
		})
		throw new Error(`tiktok_video_init_failed:${code}:${msg}`)
	}

	const publishId = json.data?.publish_id?.trim()
	if (!publishId) {
		throw new Error("tiktok_video_init_missing_publish_id")
	}

	logger.info("tiktok_video_init_ok", { publishId })
	return { publishId }
}

export type TiktokPublishStatus =
	| "PROCESSING_DOWNLOAD"
	| "PUBLISH_COMPLETE"
	| "SEND_TO_USER_INBOX"
	| "FAILED"
	| string

export type TiktokPollResult = {
	/** `PUBLISH_COMPLETE` = public post; `SEND_TO_USER_INBOX` = unaudited app draft. */
	status: "PUBLISH_COMPLETE" | "SEND_TO_USER_INBOX"
	publishId: string
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Polls TikTok's publish status endpoint until the video is either published
 * or sent to the creator's inbox (unaudited app behaviour).
 *
 * Polling interval: 5s (default). Timeout: 120s (default).
 * Rate limit on the status endpoint: 30 req/min per access token.
 */
export async function pollTiktokPublishStatus(input: {
	accessToken: string
	publishId: string
	timeoutMs?: number
	intervalMs?: number
}): Promise<TiktokPollResult> {
	const timeoutMs = input.timeoutMs ?? 120_000
	const intervalMs = input.intervalMs ?? 5_000
	const deadline = Date.now() + timeoutMs

	while (Date.now() < deadline) {
		const res = await fetch(
			`${TIKTOK_API_BASE}/v2/post/publish/status/fetch/`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${input.accessToken}`,
					"Content-Type": "application/json; charset=UTF-8",
				},
				body: JSON.stringify({ publish_id: input.publishId }),
				signal: AbortSignal.timeout(15_000),
			},
		)

		const json = (await res.json().catch(() => ({}))) as {
			data?: {
				status?: TiktokPublishStatus
				fail_reason?: string
				publicaly_available_post_id?: number[]
			}
			error?: { code?: string; message?: string }
		}

		const status = json.data?.status

		logger.info("tiktok_publish_status_poll", {
			publishId: input.publishId,
			tiktokStatus: status,
		})

		if (status === "PUBLISH_COMPLETE") {
			return { status: "PUBLISH_COMPLETE", publishId: input.publishId }
		}

		if (status === "SEND_TO_USER_INBOX") {
			// App not yet audited — video is in creator's TikTok draft inbox.
			logger.warn("tiktok_sent_to_inbox", {
				publishId: input.publishId,
				note: "App not audited for public posts. Video saved as draft in creator inbox.",
			})
			return { status: "SEND_TO_USER_INBOX", publishId: input.publishId }
		}

		if (status === "FAILED") {
			const reason = json.data?.fail_reason ?? "unknown"
			logger.error("tiktok_publish_failed", {
				publishId: input.publishId,
				failReason: reason,
			})
			throw new Error(`tiktok_publish_failed:${reason}`)
		}

		// Still processing (PROCESSING_DOWNLOAD or unknown) — wait and retry.
		if (Date.now() + intervalMs < deadline) {
			await sleep(intervalMs)
		}
	}

	throw new Error(
		`tiktok_publish_timeout: publish_id=${input.publishId} exceeded ${timeoutMs}ms`,
	)
}
