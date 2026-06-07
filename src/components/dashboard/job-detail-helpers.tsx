import { Link } from "@tanstack/react-router"
import { Timer, Unplug } from "lucide-react"

import { MAX_PUBLISH_RETRIES } from "@/features/video/video-jobs.functions"
import {
	type PublishingPlatform,
	platformDisplayName,
} from "@/lib/platform-publishing"
import { Button } from "../ui/button"

/**
 * True when `publishLastError` indicates a revoked / expired OAuth token —
 * used to show a friendly "Reconnect [Platform]" prompt instead of a raw error.
 */
export function isTokenError(error: string): boolean {
	const e = error.toLowerCase()
	return (
		e === "missing_oauth_refresh_token" ||
		e.includes("invalid_grant") ||
		e.includes("token has been") ||
		e.includes("revoked")
	)
}

/** True when the creator has hit their daily TikTok post cap. */
export function isPostCapError(error: string): boolean {
	return error === "creator_post_cap_reached"
}

/** True when the video exceeds the creator's maximum post duration on TikTok. */
export function isDurationError(error: string): boolean {
	return error === "duration_exceeds_tiktok_limit"
}

// ---------------------------------------------------------------------------
// Publish error banners
// ---------------------------------------------------------------------------

export function PostCapErrorBanner({
	publishRetryCount,
	isRetrying,
	onRetry,
}: {
	publishRetryCount: number
	isRetrying: boolean
	onRetry: () => void
}) {
	return (
		<div className="rounded-lg border border-amber-500/35 bg-amber-500/8 px-3 py-2.5">
			<div className="flex items-center gap-2">
				<Timer className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
				<p className="text-sm font-medium text-foreground">
					Daily post limit reached
				</p>
			</div>
			<p className="mt-1 text-xs text-muted-foreground">
				TikTok limits how many videos can be posted per day. Try again tomorrow.
			</p>
			{publishRetryCount < MAX_PUBLISH_RETRIES ? (
				<Button
					type="button"
					size="sm"
					variant="outline"
					className="mt-2 h-7 text-xs"
					disabled={isRetrying}
					onClick={onRetry}
				>
					{isRetrying ? "Retrying…" : "Retry publish"}
				</Button>
			) : (
				<p className="mt-2 text-xs text-muted-foreground">
					Max retries reached.
				</p>
			)}
		</div>
	)
}

export function DurationErrorBanner() {
	return (
		<div className="rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2.5">
			<p className="text-sm font-medium text-foreground">
				Video too long for your TikTok account
			</p>
			<p className="mt-1 text-xs text-muted-foreground">
				The video exceeds your account&apos;s maximum post duration on TikTok.
				Generate a shorter video and try again.
			</p>
		</div>
	)
}

export function TokenErrorBanner({
	channelId,
	channelPlatform,
	publishRetryCount,
	isRetrying,
	onRetry,
}: {
	channelId: string
	channelPlatform: PublishingPlatform
	publishRetryCount: number
	isRetrying: boolean
	onRetry: () => void
}) {
	return (
		<div className="rounded-lg border border-amber-500/35 bg-amber-500/8 px-3 py-2.5">
			<div className="flex items-center gap-2">
				<Unplug className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
				<p className="text-sm font-medium text-foreground">
					{platformDisplayName(channelPlatform)} access expired
				</p>
			</div>
			<p className="mt-1 text-xs text-muted-foreground">
				Klipse lost access to your {platformDisplayName(channelPlatform)}{" "}
				account. Reconnect then retry publishing.
			</p>
			<div className="mt-2 flex flex-wrap items-center gap-3">
				<Link
					to="/dashboard/publishing/$destinationId"
					params={{ destinationId: channelId }}
					className="text-xs font-semibold text-primary hover:underline"
				>
					Reconnect {platformDisplayName(channelPlatform)} →
				</Link>
				{publishRetryCount < MAX_PUBLISH_RETRIES ? (
					<Button
						type="button"
						size="sm"
						variant="outline"
						className="h-7 text-xs"
						disabled={isRetrying}
						onClick={onRetry}
					>
						{isRetrying ? "Retrying…" : "Retry publish"}
					</Button>
				) : (
					<p className="text-xs text-muted-foreground">Max retries reached.</p>
				)}
			</div>
		</div>
	)
}

export function GenericPublishErrorBanner({
	error,
	publishRetryCount,
	isRetrying,
	onRetry,
}: {
	error: string
	publishRetryCount: number
	isRetrying: boolean
	onRetry: () => void
}) {
	return (
		<div className="flex flex-wrap items-center gap-3">
			<p className="text-xs text-destructive">Publish failed: {error}</p>
			{publishRetryCount < MAX_PUBLISH_RETRIES ? (
				<Button
					type="button"
					size="sm"
					variant="outline"
					className="h-7 text-xs"
					disabled={isRetrying}
					onClick={onRetry}
				>
					{isRetrying ? "Retrying…" : "Retry publish"}
				</Button>
			) : (
				<p className="text-xs text-muted-foreground">Max retries reached.</p>
			)}
		</div>
	)
}
