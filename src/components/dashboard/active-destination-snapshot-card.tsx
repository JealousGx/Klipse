import { Link } from "@tanstack/react-router"

import type { ChannelSnapshot } from "@/features/channels/channel-snapshot.types"

import {
	platformChannelUrl,
	platformDisplayName,
} from "@/lib/platform-publishing"
import { cn } from "@/lib/utils"

import { Button } from "../ui/button"
import { tagFromNiche } from "./utils"

export function ActiveDestinationSnapshotCard({
	channel,
	isLoading,
}: {
	channel: ChannelSnapshot | null
	isLoading: boolean
}) {
	if (isLoading) {
		return (
			<div
				className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
				aria-busy
			>
				<div className="h-11 animate-pulse border-b border-border bg-muted/40" />
				<div className="space-y-3 p-4">
					<div className="h-4 w-3/4 animate-pulse rounded bg-muted/60" />
					<div className="h-3 w-full animate-pulse rounded bg-muted/40" />
				</div>
			</div>
		)
	}

	if (!channel) {
		return (
			<section className="overflow-hidden rounded-xl border border-dashed border-border/80 bg-muted/10 p-6 text-center shadow-sm">
				<p className="font-heading text-sm font-semibold text-foreground">
					Publishing destination
				</p>
				<p className="mt-2 text-sm text-muted-foreground">
					Add a destination to attach uploads and channel metadata.
				</p>
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="mt-4"
					asChild
				>
					<Link to="/dashboard/publishing">Publishing</Link>
				</Button>
			</section>
		)
	}

	const linked =
		channel.platform !== "unlinked" && Boolean(channel.externalChannelId)
	const platformName = platformDisplayName(channel.platform)
	const badgeLabel = channel.oauthConnected
		? `${platformName} · connected`
		: linked
			? `${platformName} · linked`
			: "Not connected"

	const tagBits = [
		platformDisplayName(channel.platform),
		...tagFromNiche(channel.niche).slice(0, 3),
	]

	return (
		<section
			className="overflow-hidden rounded-xl border border-border bg-card text-left shadow-sm"
			aria-label="Primary publishing destination"
		>
			<div className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-3">
				<div className="flex flex-wrap items-center gap-2">
					<span className="font-heading text-sm font-semibold text-foreground">
						Active destination
					</span>
					<span
						className={cn(
							"rounded border px-2 py-0.5 font-mono text-[10px] font-medium",
							linked || channel.oauthConnected
								? "border-primary/40 bg-primary/10 text-primary"
								: "border-border bg-background text-muted-foreground",
						)}
					>
						{badgeLabel}
					</span>
				</div>
				<Button
					variant="outline"
					size="sm"
					className="h-8 text-xs font-semibold"
					asChild
				>
					<Link
						to="/dashboard/publishing/$destinationId"
						params={{ destinationId: channel.id }}
					>
						Manage
					</Link>
				</Button>
			</div>
			<div className="space-y-3 p-4">
				<div>
					<p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
						Name
					</p>
					<p className="mt-0.5 font-medium text-foreground">{channel.name}</p>
				</div>
				<div>
					<p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
						Niche
					</p>
					<p className="mt-0.5 line-clamp-3 text-sm text-muted-foreground">
						{channel.niche}
					</p>
				</div>
				<div>
					<p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
						Tags
					</p>
					<div className="mt-1.5 flex flex-wrap gap-1.5">
						{tagBits.map((tag) => (
							<span
								key={tag}
								className="rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs font-medium text-foreground"
							>
								{tag}
							</span>
						))}
					</div>
				</div>
				{channel.externalChannelId ? (
					<div>
						<p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
							Channel id
						</p>
						<p className="mt-0.5 font-mono text-xs text-foreground break-all">
							{channel.externalChannelId}
						</p>
						{channel.externalChannelId &&
						platformChannelUrl(channel.platform, channel.externalChannelId) ? (
							<a
								href={
									platformChannelUrl(
										channel.platform,
										channel.externalChannelId,
									) as string
								}
								target="_blank"
								rel="noopener noreferrer"
								className="mt-2 inline-block text-xs font-semibold text-primary hover:underline"
							>
								Open on {platformDisplayName(channel.platform)} →
							</a>
						) : null}
					</div>
				) : null}
			</div>
		</section>
	)
}
