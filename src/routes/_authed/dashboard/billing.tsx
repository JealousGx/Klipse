import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { ExternalLink, Loader2, Wallet } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { z } from "zod"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

import { useDashboardRouteContext } from "@/context/useDashboardRouteContext"

import {
	BillingPlansSection,
	PLAN_RANK,
} from "@/features/billing/ui/billing-plan-section"
import type { MeResponse } from "@/features/user/types/me"

import { authClient } from "@/lib/auth/client"
import { analyticsQueryOptions } from "@/lib/queries/dashboard-queries"
import { cn } from "@/lib/utils"

const billingSearchSchema = z.object({
	/** Set by Polar `successUrl` in `polar-plugin.server.ts` after checkout. */
	checkout: z.literal("success").optional(),
})

export const Route = createFileRoute("/_authed/dashboard/billing")({
	staticData: { dashboardTitle: "Billing" },
	validateSearch: (raw: Record<string, unknown>) => {
		const parsed = billingSearchSchema.safeParse(raw)
		return parsed.success ? parsed.data : {}
	},
	component: BillingPage,
})

const planLabel: Record<MeResponse["plan"], string> = {
	free: "Free",
	starter: "Starter",
	creator: "Creator",
	empire: "Empire",
}

function BillingPage() {
	const search = Route.useSearch()
	const navigate = Route.useNavigate()
	const { refetch } = authClient.useSession()
	const checkoutRefreshDone = useRef(false)

	const { session } = useDashboardRouteContext()
	const user = session.user
	const [loadingSlug, setLoadingSlug] = useState<string | null>(null)
	const [portalLoading, setPortalLoading] = useState(false)

	const userPlan = user.plan as MeResponse["plan"]
	const userRank = PLAN_RANK[userPlan] ?? 0
	const hasPaidPlan = userPlan !== "free"

	/** One DB-backed session load after Polar redirects here (webhook may lag cookie cache). */
	useEffect(() => {
		if (search.checkout !== "success" || checkoutRefreshDone.current) {
			return
		}
		checkoutRefreshDone.current = true
		void refetch({ query: { disableCookieCache: true } }).finally(() => {
			void navigate({
				search: (prev) => {
					const { checkout: _c, ...rest } = prev
					return rest
				},
				replace: true,
			})
		})
	}, [search.checkout, refetch, navigate])

	const runCheckout = async (slug: string) => {
		setLoadingSlug(slug)
		try {
			await authClient.checkout({ slug })
		} finally {
			setLoadingSlug(null)
		}
	}

	const openPortal = async () => {
		setPortalLoading(true)
		try {
			const res = await authClient.customer.portal({ redirect: false })
			if (res.error) {
				toast.error("Couldn't open portal", {
					description: res.error.message ?? "Try again in a moment.",
				})
				return
			}
			const url = res.data?.url
			if (url) {
				window.open(url, "_blank", "noopener,noreferrer")
			}
		} finally {
			setPortalLoading(false)
		}
	}

	const credits = user.creditsRemaining ?? 0

	const analyticsQuery = useQuery(analyticsQueryOptions)

	const currentMonth = new Date().toLocaleString(undefined, {
		month: "long",
	})
	const videosThisMonth = analyticsQuery.data?.totalCompleted ?? null

	return (
		<div className="space-y-12">
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
								Billing & usage
							</Badge>
							<h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
								Scale your workflow
							</h1>
							<p className="text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
								Subscriptions and credit packs are processed securely through
								Polar. Your plan and balance update automatically after payment.
							</p>
						</div>
						<div
							className={cn(
								"flex w-full max-w-md shrink-0 flex-col gap-4 sm:max-w-none lg:max-w-55",
								"sm:flex-row sm:items-stretch lg:flex-col",
							)}
						>
							<div
								className={cn(
									"w-full min-w-0 rounded-xl border border-border/60 bg-background/80 px-5 py-4",
									"shadow-sm backdrop-blur-sm dark:bg-card/60",
									"sm:flex-1 sm:basis-0",
								)}
							>
								<p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
									Videos in {currentMonth}
								</p>
								<p className="mt-1 font-heading text-3xl font-bold tabular-nums tracking-tight text-foreground">
									{videosThisMonth !== null
										? videosThisMonth.toLocaleString()
										: "—"}
								</p>
								<p className="mt-1 text-xs text-muted-foreground">
									{credits.toLocaleString()} credits remaining
								</p>
							</div>
							<div
								className={cn(
									"w-full min-w-0 rounded-xl border border-border/60 bg-background/80 px-5 py-4",
									"shadow-sm backdrop-blur-sm dark:bg-card/60",
									"sm:flex-1 sm:basis-0",
								)}
							>
								<p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
									Current plan
								</p>
								<p className="mt-1 font-heading text-xl font-semibold text-foreground">
									{planLabel[userPlan]}
								</p>
							</div>
						</div>
					</div>
				</div>
			</section>

			<BillingPlansSection
				userPlan={userPlan}
				userRank={userRank}
				hasPaidPlan={hasPaidPlan}
				loadingSlug={loadingSlug}
				onCheckout={(slug) => void runCheckout(slug)}
			/>

			<section
				className={cn(
					"overflow-hidden rounded-2xl border border-border/70",
					"bg-linear-to-r from-muted/40 via-muted/25 to-muted/40",
					"dark:from-muted/25 dark:via-muted/15 dark:to-muted/25",
				)}
			>
				<div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:p-8">
					<div className="flex gap-4">
						<div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-background/90 shadow-sm ring-1 ring-border/60 dark:bg-card/80">
							<Wallet className="size-6 text-primary" strokeWidth={1.5} />
						</div>
						<div className="min-w-0 space-y-1">
							<p className="font-heading text-lg font-semibold text-foreground">
								Customer portal
							</p>
							<p className="max-w-md text-sm leading-relaxed text-muted-foreground">
								Update payment method, download invoices, or manage your
								subscription in Polar—opens in a new tab.
							</p>
						</div>
					</div>
					<Button
						type="button"
						size="lg"
						aria-busy={portalLoading}
						className="inline-flex min-w-54 shrink-0 justify-center gap-2 shadow-md"
						disabled={portalLoading}
						onClick={() => void openPortal()}
					>
						{portalLoading ? (
							<Loader2 className="size-4 animate-spin" aria-hidden />
						) : (
							<>
								Open portal
								<ExternalLink className="size-4 opacity-90" aria-hidden />
							</>
						)}
					</Button>
				</div>
			</section>

			<p className="text-center text-xs text-muted-foreground/70">
				By purchasing you agree to our{" "}
				<Link
					to="/terms"
					className="underline underline-offset-2 hover:text-muted-foreground transition-colors"
				>
					Terms of Service
				</Link>
				,{" "}
				<Link
					to="/refund"
					className="underline underline-offset-2 hover:text-muted-foreground transition-colors"
				>
					Refund Policy
				</Link>
				, and{" "}
				<Link
					to="/privacy"
					className="underline underline-offset-2 hover:text-muted-foreground transition-colors"
				>
					Privacy Policy
				</Link>
				. All sales final — no refunds.
			</p>
		</div>
	)
}
