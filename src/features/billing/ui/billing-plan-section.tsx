import {
	ArrowUpRight,
	Coins,
	Crown,
	Loader2,
	Sparkles,
	Zap,
} from "lucide-react"

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
import {
	CREDIT_ADDON_AMOUNTS,
	MONTHLY_CREDITS_BY_PLAN,
} from "@/features/billing/tier-config"
import type { MeResponse } from "@/features/user/types/me"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Plan rank lookup (exported so BillingPage can derive userRank)
// ---------------------------------------------------------------------------

export const PLAN_RANK: Record<MeResponse["plan"], number> = {
	free: 0,
	starter: 1,
	creator: 2,
	empire: 3,
}

// ---------------------------------------------------------------------------
// Subscription tier metadata
// ---------------------------------------------------------------------------

const subscriptionSlugs = [
	{
		slug: "starter" as const,
		title: "Starter",
		price: "$27",
		period: "/mo",
		blurb: "~60 shorts / mo internal budget.",
		icon: Sparkles,
		accent: "from-chart-1/25 to-chart-1/5",
		iconClass: "text-chart-1",
	},
	{
		slug: "creator" as const,
		title: "Creator",
		price: "$63",
		period: "/mo",
		blurb: "~200 shorts / mo internal budget.",
		icon: Zap,
		highlight: true,
		accent: "from-primary/25 to-chart-2/15",
		iconClass: "text-primary",
	},
	{
		slug: "empire" as const,
		title: "Empire",
		price: "$123",
		period: "/mo",
		blurb: "Highest tier; long-form & priority (when shipped).",
		icon: Crown,
		accent: "from-chart-2/30 to-chart-3/10",
		iconClass: "text-chart-2",
	},
]

// ---------------------------------------------------------------------------
// CreditPackCard
// ---------------------------------------------------------------------------

function CreditPackCard({
	label,
	amount,
	loading,
	disabled,
	onPurchase,
	emphasis,
}: {
	label: string
	amount: number
	loading: boolean
	disabled: boolean
	onPurchase: () => void
	emphasis?: boolean
}) {
	return (
		<div
			className={cn(
				"group relative flex flex-col justify-between rounded-2xl border p-5 transition-colors",
				emphasis
					? "border-primary/35 bg-linear-to-br from-primary/6 to-transparent dark:from-primary/10"
					: "border-border/80 bg-card/50 hover:border-border dark:bg-card/30",
			)}
		>
			<div className="flex items-start gap-3">
				<div
					className={cn(
						"flex size-10 items-center justify-center rounded-xl",
						emphasis
							? "bg-primary/15 text-primary"
							: "bg-muted text-muted-foreground",
					)}
				>
					<Coins className="size-5" strokeWidth={1.5} />
				</div>
				<div>
					<p className="font-heading font-semibold text-foreground">{label}</p>
					<p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-foreground">
						+{amount.toLocaleString()}{" "}
						<span className="text-sm font-medium text-muted-foreground">
							credits
						</span>
					</p>
				</div>
			</div>
			<Button
				type="button"
				className="mt-5 w-full gap-2"
				variant={emphasis ? "default" : "outline"}
				disabled={disabled}
				onClick={onPurchase}
			>
				{loading ? (
					<Loader2 className="size-4 animate-spin" />
				) : (
					<>
						Buy pack
						<ArrowUpRight className="size-4 opacity-80 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
					</>
				)}
			</Button>
		</div>
	)
}

// ---------------------------------------------------------------------------
// BillingPlansSection — plans grid + optional credit packs
// ---------------------------------------------------------------------------

export function BillingPlansSection({
	userPlan,
	userRank,
	hasPaidPlan,
	loadingSlug,
	onCheckout,
}: {
	userPlan: MeResponse["plan"]
	userRank: number
	hasPaidPlan: boolean
	loadingSlug: string | null
	onCheckout: (slug: string) => void
}) {
	return (
		<>
			<section className="space-y-6">
				<div>
					<h2 className="font-heading text-lg font-semibold tracking-tight text-foreground">
						Plans
					</h2>
					<p className="mt-1 max-w-2xl text-sm text-muted-foreground">
						Pick a tier that matches your output. Credits shown are internal
						metering budgets per billing period.
					</p>
				</div>

				<div className="grid gap-6 lg:grid-cols-3">
					{subscriptionSlugs.map((tier) => {
						const Icon = tier.icon
						const isCurrent = userPlan === tier.slug
						const tierRank = PLAN_RANK[tier.slug]
						const loading = loadingSlug === tier.slug

						let cta: string
						if (isCurrent) {
							cta = "Your plan"
						} else if (userRank === 0) {
							cta = `Get ${tier.title}`
						} else if (tierRank > userRank) {
							cta = "Upgrade"
						} else {
							cta = "Switch plan"
						}

						return (
							<Card
								key={tier.slug}
								className={cn(
									"relative flex flex-col overflow-hidden border-border/80 transition-shadow duration-300",
									tier.highlight &&
										"border-primary/45 shadow-lg shadow-primary/10 ring-1 ring-primary/25 dark:shadow-primary/5",
									isCurrent &&
										"border-primary/35 bg-muted/25 ring-1 ring-primary/20 dark:bg-muted/15",
								)}
							>
								{tier.highlight ? (
									<div className="absolute right-4 top-4">
										<Badge className="font-medium shadow-sm">Popular</Badge>
									</div>
								) : null}
								<div
									className={cn(
										"h-1.5 bg-linear-to-r",
										tier.accent ?? "from-muted to-muted",
									)}
									aria-hidden
								/>
								<CardHeader className="pb-2 pt-6">
									<div className="flex items-start gap-3">
										<div
											className={cn(
												"flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted/80 dark:bg-muted/50",
												tier.iconClass,
											)}
										>
											<Icon className="size-5" strokeWidth={1.75} />
										</div>
										<div className="min-w-0 flex-1 pt-0.5">
											<CardTitle className="font-heading text-xl font-bold">
												{tier.title}
											</CardTitle>
											<CardDescription className="mt-2 flex flex-wrap items-baseline gap-0.5">
												<span className="text-2xl font-semibold tracking-tight text-foreground">
													{tier.price}
												</span>
												<span className="text-sm text-muted-foreground">
													{tier.period}
												</span>
											</CardDescription>
										</div>
									</div>
								</CardHeader>
								<CardContent className="flex-1 space-y-3 pb-2">
									<p className="text-sm leading-relaxed text-muted-foreground">
										{tier.blurb}
									</p>
									<p className="text-xs text-muted-foreground/90">
										~{MONTHLY_CREDITS_BY_PLAN[tier.slug].toLocaleString()}{" "}
										credits / period
									</p>
								</CardContent>
								<CardFooter className="pt-2">
									<Button
										type="button"
										className="w-full"
										variant={
											tier.highlight && !isCurrent ? "default" : "secondary"
										}
										disabled={isCurrent || loadingSlug !== null}
										onClick={() => onCheckout(tier.slug)}
									>
										{loading ? (
											<Loader2 className="size-4 animate-spin" />
										) : (
											cta
										)}
									</Button>
								</CardFooter>
							</Card>
						)
					})}
				</div>
			</section>

			{hasPaidPlan ? (
				<section className="space-y-5">
					<div>
						<h2 className="font-heading text-lg font-semibold tracking-tight text-foreground">
							Credit packs
						</h2>
						<p className="mt-1 max-w-2xl text-sm text-muted-foreground">
							One-time top-ups when you need extra capacity—great for campaigns
							or spikes.
						</p>
					</div>
					<div className="grid gap-4 sm:grid-cols-2">
						<CreditPackCard
							label="Small pack"
							amount={CREDIT_ADDON_AMOUNTS.small}
							loading={loadingSlug === "credits-1k"}
							disabled={loadingSlug !== null}
							onPurchase={() => onCheckout("credits-1k")}
						/>
						<CreditPackCard
							label="Large pack"
							amount={CREDIT_ADDON_AMOUNTS.large}
							loading={loadingSlug === "credits-3k"}
							disabled={loadingSlug !== null}
							onPurchase={() => onCheckout("credits-3k")}
							emphasis
						/>
					</div>
				</section>
			) : null}
		</>
	)
}
