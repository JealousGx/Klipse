import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { ArrowUpRight, Loader2, Plus } from "lucide-react"
import { useEffect } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

import { useDashboardRouteContext } from "@/context/useDashboardRouteContext"

import {
	MAX_CHANNELS_BY_PLAN,
	planAllowsPaidPublishingConnections,
} from "@/features/billing/tier-config"
import {
	createChannelFn,
	deleteChannelFn,
	reconcileYoutubeOAuthFn,
} from "@/features/channels/channels.functions"
import { DestinationCard } from "@/features/publishing-destination/destination-card"
import {
	messageForPublishingConnectionErrorReason,
	publishingDestinationSearchSchema,
} from "@/features/publishing-destination/publishing-destination-search.schema"
import type { MeResponse } from "@/features/user/types/me"

import {
	platformAuthProviderName,
	platformOAuthStartUrl,
} from "@/lib/platform-publishing"
import { channelsQueryOptions } from "@/lib/queries/dashboard-queries"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/_authed/dashboard/publishing/")({
	staticData: { dashboardTitle: "Publishing" },
	validateSearch: (raw: Record<string, unknown>) => {
		const p = publishingDestinationSearchSchema.safeParse(raw)
		return p.success ? p.data : {}
	},
	component: PublishingIndexPage,
})

const DEFAULT_NEW_DESTINATION_NICHE =
	"Link your Google account to publish finished videos to this destination."

function PublishingIndexPage() {
	const search = Route.useSearch()
	const queryClient = useQueryClient()
	const navigate = useNavigate()
	const { session } = useDashboardRouteContext()

	useEffect(() => {
		if (!search.oauth) {
			return
		}
		if (search.oauth === "connected") {
			toast.success("Publishing account connected successfully.")
		} else {
			toast.error(messageForPublishingConnectionErrorReason(search.reason))
		}
		void navigate({
			to: "/dashboard/publishing",
			search: {},
			replace: true,
		})
	}, [search.oauth, search.reason, navigate])

	useEffect(() => {
		let cancelled = false
		void reconcileYoutubeOAuthFn({ data: {} }).then((r) => {
			if (cancelled || !r.ok || r.revokedChannelIds.length === 0) {
				return
			}
			toast.warning(
				r.revokedChannelIds.length === 1
					? "Google access for one publishing destination was revoked or expired. Open it and reconnect with Google."
					: "Google access for some publishing destinations was revoked or expired. Reconnect each one under Publishing.",
				{ id: "youtube-oauth-revoked-list" },
			)
			void queryClient.invalidateQueries({ queryKey: ["channels"] })
		})
		return () => {
			cancelled = true
		}
	}, [queryClient])

	const userPlan = (session.user.plan ?? "free") as MeResponse["plan"]
	const maxDestinations = MAX_CHANNELS_BY_PLAN[userPlan]
	const canConnectPublishing = planAllowsPaidPublishingConnections(userPlan)

	const destinationsQuery = useQuery(channelsQueryOptions)

	const createMutation = useMutation({
		mutationFn: async () => {
			const n = (destinationsQuery.data?.length ?? 0) + 1
			return createChannelFn({
				data: {
					name: `Publishing destination ${n}`,
					niche: DEFAULT_NEW_DESTINATION_NICHE,
				},
			})
		},
		onSuccess: async (r) => {
			if (r.ok) {
				toast.success("Publishing destination created")
				await queryClient.invalidateQueries({ queryKey: ["channels"] })
				void navigate({
					to: "/dashboard/publishing/$destinationId",
					params: { destinationId: r.channel.id },
				})
				return
			}
			if (r.code === "channel_limit") {
				toast.error(r.message ?? "Destination limit reached for your plan.")
				return
			}
			toast.error("Could not create destination")
		},
		onError: (_err) => {
			toast.error("Could not create destination")
		},
	})

	const deleteMutation = useMutation({
		mutationFn: (channelId: string) => deleteChannelFn({ data: { channelId } }),
		onSuccess: (r) => {
			if (r.ok) {
				toast.success("Destination removed")
				void queryClient.invalidateQueries({ queryKey: ["channels"] })
				void queryClient.invalidateQueries({ queryKey: ["video-jobs"] })
				return
			}
			toast.error("Couldn't remove destination")
		},
	})

	const loading = destinationsQuery.isPending
	const list = destinationsQuery.data ?? []
	const canAddDestination = list.length < maxDestinations

	const firstNeedingOAuth = list.find((c) => !c.oauthConnected)
	const primaryDestinationId = firstNeedingOAuth?.id ?? list[0]?.id ?? null

	const handleDelete = (channelId: string) => {
		if (
			typeof window !== "undefined" &&
			!window.confirm(
				"Remove this publishing destination? Associated video jobs may be deleted.",
			)
		) {
			return
		}
		deleteMutation.mutate(channelId)
	}

	return (
		<div className="space-y-12">
			{/* Hero */}
			<section
				className={cn(
					"relative overflow-hidden rounded-2xl border border-border/70",
					"bg-linear-to-br from-primary/9 via-background to-chart-2/7",
					"dark:from-primary/12 dark:via-background dark:to-chart-2/8",
				)}
			>
				<div
					className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-primary/15 blur-3xl dark:bg-primary/20"
					aria-hidden
				/>
				<div
					className="pointer-events-none absolute -bottom-16 -left-16 size-56 rounded-full bg-chart-2/20 blur-3xl"
					aria-hidden
				/>
				<div className="relative px-6 py-8 sm:px-10 sm:py-10">
					<div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
						<div className="max-w-xl space-y-3">
							<Badge variant="secondary" className="font-medium">
								Publishing
							</Badge>
							<h2 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
								Where videos go live
							</h2>
							<p className="text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
								Connect YouTube, TikTok, or Instagram—all platforms follow the
								same pipeline. Names here are Klipse labels; your public channel
								title appears after you link an account.
							</p>
						</div>
						<div
							className={cn(
								"flex w-full max-w-md shrink-0 flex-col gap-3 sm:max-w-none lg:max-w-xs",
							)}
						>
							{primaryDestinationId !== null && firstNeedingOAuth ? (
								canConnectPublishing ? (
									<Button
										type="button"
										size="lg"
										className="h-11 w-full gap-2 shadow-md shadow-primary/15"
										asChild
									>
										<a
											href={
												platformOAuthStartUrl(
													firstNeedingOAuth.platform,
													primaryDestinationId,
												) ?? "#"
											}
										>
											Connect with{" "}
											{platformAuthProviderName(firstNeedingOAuth.platform)}
											<ArrowUpRight className="size-4 opacity-90" aria-hidden />
										</a>
									</Button>
								) : (
									<Button
										type="button"
										size="lg"
										className="h-11 w-full gap-2 shadow-md shadow-primary/15"
										asChild
									>
										<Link to="/dashboard/billing">
											Upgrade to connect
											<ArrowUpRight className="size-4 opacity-90" aria-hidden />
										</Link>
									</Button>
								)
							) : primaryDestinationId !== null ? (
								<div
									className={cn(
										"w-full rounded-xl border border-border/60 bg-background/80 px-5 py-4",
										"shadow-sm backdrop-blur-sm dark:bg-card/60",
									)}
								>
									<p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
										Quick action
									</p>
									<Button
										variant="link"
										className="mt-1 h-auto p-0 font-heading text-lg font-semibold"
										asChild
									>
										<Link
											to="/dashboard/publishing/$destinationId"
											params={{ destinationId: primaryDestinationId }}
										>
											Open destination
											<ArrowUpRight className="size-4" aria-hidden />
										</Link>
									</Button>
								</div>
							) : (
								<Button
									type="button"
									size="lg"
									className="h-11 w-full"
									disabled={loading}
								>
									Add a destination
								</Button>
							)}
						</div>
					</div>
				</div>
			</section>

			<section className="space-y-6">
				<div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
					<div>
						<h3 className="font-heading text-lg font-semibold tracking-tight text-foreground">
							Destinations
						</h3>
						<p className="mt-1 max-w-2xl text-sm text-muted-foreground">
							Each card is one publishing slot. Add more up to your plan limit,
							then connect a platform account per destination.
						</p>
					</div>
					<div className="flex flex-wrap items-center gap-3">
						<Badge variant="outline" className="tabular-nums">
							{list.length} / {maxDestinations}
						</Badge>
						{canAddDestination ? (
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="gap-2"
								disabled={createMutation.isPending || loading}
								onClick={() => createMutation.mutate()}
							>
								{createMutation.isPending ? (
									<Loader2 className="size-4 animate-spin" aria-hidden />
								) : (
									<Plus className="size-4" aria-hidden />
								)}
								Add destination
							</Button>
						) : userPlan === "empire" && list.length >= maxDestinations ? (
							<p className="text-xs text-muted-foreground">
								Empire limit reached (20). Remove one to add another.
							</p>
						) : (
							<Button type="button" variant="outline" size="sm" asChild>
								<Link to="/dashboard/billing">Upgrade for more</Link>
							</Button>
						)}
					</div>
				</div>

				{loading ? (
					<p className="text-sm text-muted-foreground">Loading destinations…</p>
				) : list.length === 0 ? (
					<div
						className={cn(
							"rounded-2xl border border-dashed border-border/70 bg-muted/10 px-6 py-16",
							"text-center text-sm text-muted-foreground",
						)}
					>
						No destinations yet. Refresh, or contact support if this persists.
					</div>
				) : (
					<ul
						className={cn(
							"grid gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3",
						)}
					>
						{list.map((ch) => (
							<li key={ch.id}>
								<DestinationCard
									ch={ch}
									onDelete={handleDelete}
									deletePending={deleteMutation.isPending}
									deleteTargetId={deleteMutation.variables}
								/>
							</li>
						))}
					</ul>
				)}
			</section>
		</div>
	)
}
