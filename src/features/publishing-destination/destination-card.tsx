import { Link } from "@tanstack/react-router"
import {
	ArrowUpRight,
	Copy,
	ExternalLink,
	Loader2,
	Pencil,
	Trash2,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { PublishingChannelThumbnail } from "@/features/publishing-destination/publishing-channel-thumbnail"
import {
	platformChannelUrl,
	platformDisplayName,
} from "@/lib/platform-publishing"
import { cn } from "@/lib/utils"

export type PublishingListChannel = {
	id: string
	name: string
	niche: string
	platform: "unlinked" | "youtube" | "tiktok" | "instagram"
	externalChannelId: string | null
	externalChannelTitle: string | null
	externalChannelThumbnailUrl: string | null
	/** True when an active OAuth refresh token is stored. Drives the Linked badge. */
	oauthConnected: boolean
}

export type DestinationCardProps = {
	ch: PublishingListChannel
	onDelete: (id: string) => void
	deletePending: boolean
	deleteTargetId: string | undefined
}

export function DestinationCard({
	ch,
	onDelete,
	deletePending,
	deleteTargetId,
}: DestinationCardProps) {
	const isLinked = ch.oauthConnected

	return (
		<Card
			className={cn(
				"group relative flex h-full flex-col overflow-hidden border-border/80 transition-[border-color,box-shadow] duration-300",
				"hover:border-primary/35 hover:shadow-lg hover:shadow-primary/5",
				isLinked && "ring-1 ring-primary/20 dark:ring-primary/25",
			)}
		>
			<div
				className={cn(
					"h-1.5 bg-linear-to-r",
					isLinked
						? "from-primary/55 via-primary/35 to-chart-2/45"
						: "from-muted/70 to-muted/40",
				)}
				aria-hidden
			/>

			<CardHeader className="space-y-3 pb-2">
				<div className="flex items-start gap-3">
					<PublishingChannelThumbnail
						src={ch.externalChannelThumbnailUrl}
						alt={
							ch.externalChannelTitle
								? `${ch.externalChannelTitle} channel image`
								: "Publishing destination"
						}
						size="sm"
						className={cn(
							isLinked && "ring-1 ring-primary/25 dark:ring-primary/30",
						)}
					/>
					<div className="min-w-0 flex-1 space-y-1.5">
						<div className="flex items-start justify-between gap-2">
							<CardTitle className="font-heading text-base font-semibold leading-snug">
								<Link
									to="/dashboard/publishing/$destinationId"
									params={{ destinationId: ch.id }}
									className="inline-flex items-start gap-1 text-foreground transition hover:text-primary"
								>
									<span className="line-clamp-2 text-pretty">{ch.name}</span>
									<ArrowUpRight
										className="mt-0.5 size-4 shrink-0 opacity-0 transition group-hover:opacity-70"
										aria-hidden
									/>
								</Link>
							</CardTitle>
							<Badge
								variant={isLinked ? "default" : "secondary"}
								className="shrink-0 text-[10px] font-medium uppercase tracking-wide"
							>
								{isLinked ? "Linked" : "Not connected"}
							</Badge>
						</div>
						<CardDescription className="line-clamp-2 text-xs leading-relaxed">
							{ch.externalChannelTitle ?? ch.niche}
						</CardDescription>
					</div>
				</div>
			</CardHeader>

			<CardContent className="flex flex-1 flex-col gap-3 pb-2 pt-0">
				{ch.externalChannelId ? (
					<div
						className={cn(
							"rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5",
							"dark:bg-muted/10",
						)}
					>
						<p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
							{platformDisplayName(ch.platform)} channel id
						</p>
						<div className="mt-1.5 flex flex-wrap items-center gap-2">
							<code className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground">
								{ch.externalChannelId}
							</code>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="h-7 gap-1 px-2 text-[11px] text-muted-foreground"
								onClick={() => {
									void navigator.clipboard
										.writeText(ch.externalChannelId as string)
										.then(
											() =>
												toast.success(
													`${platformDisplayName(ch.platform)} channel id copied`,
												),
											() => toast.error("Could not copy"),
										)
								}}
							>
								<Copy className="size-3" aria-hidden />
								Copy
							</Button>
							{platformChannelUrl(ch.platform, ch.externalChannelId) ? (
								<a
									href={
										platformChannelUrl(
											ch.platform,
											ch.externalChannelId,
										) as string
									}
									target="_blank"
									rel="noopener noreferrer"
									className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-primary underline-offset-4 hover:underline"
								>
									<ExternalLink className="size-3" aria-hidden />
									Open
								</a>
							) : null}
						</div>
					</div>
				) : null}

				<div className="rounded-lg border border-border/40 bg-background/50 px-3 py-2 dark:bg-background/30">
					<p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
						Klipse destination id
					</p>
					<code className="mt-1 block break-all font-mono text-[11px] leading-relaxed text-foreground/90">
						{ch.id}
					</code>
				</div>
			</CardContent>

			<CardFooter className="mt-auto flex flex-wrap gap-2 border-t border-border/60 bg-muted/10 pt-4 dark:bg-muted/5">
				<Button
					variant="secondary"
					size="sm"
					className="h-9 flex-1 gap-1.5 sm:flex-none"
					asChild
				>
					<Link
						to="/dashboard/publishing/$destinationId"
						params={{ destinationId: ch.id }}
					>
						<Pencil className="size-3.5" aria-hidden />
						Edit
					</Link>
				</Button>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="h-9 flex-1 gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive sm:flex-none"
					disabled={deletePending}
					onClick={() => onDelete(ch.id)}
				>
					{deletePending && deleteTargetId === ch.id ? (
						<Loader2 className="size-3.5 animate-spin" aria-hidden />
					) : (
						<Trash2 className="size-3.5" aria-hidden />
					)}
					Remove
				</Button>
			</CardFooter>
		</Card>
	)
}
