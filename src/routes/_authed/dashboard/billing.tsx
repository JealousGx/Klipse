import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	ArrowUpRight,
	Coins,
	Crown,
	ExternalLink,
	Loader2,
	Sparkles,
	Wallet,
	Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

import { useDashboardRouteContext } from "@/context/useDashboardRouteContext";
import { getAnalyticsSummaryFn } from "@/features/analytics/analytics.functions";
import {
	CREDIT_ADDON_AMOUNTS,
	MONTHLY_CREDITS_BY_PLAN,
} from "@/features/billing/tier-config";
import type { MeResponse } from "@/features/user/types/me";

import { authClient } from "@/lib/auth/client";
import { analyticsQueryOptions } from "@/lib/queries/dashboard-queries";
import { cn } from "@/lib/utils";

const billingSearchSchema = z.object({
	/** Set by Polar `successUrl` in `polar-plugin.server.ts` after checkout. */
	checkout: z.literal("success").optional(),
});

export const Route = createFileRoute("/_authed/dashboard/billing")({
	staticData: { dashboardTitle: "Billing" },
	validateSearch: (raw: Record<string, unknown>) => {
		const parsed = billingSearchSchema.safeParse(raw);
		return parsed.success ? parsed.data : {};
	},
	component: BillingPage,
});

const planLabel: Record<MeResponse["plan"], string> = {
	free: "Free",
	starter: "Starter",
	creator: "Creator",
	empire: "Empire",
};

const PLAN_RANK: Record<MeResponse["plan"], number> = {
	free: 0,
	starter: 1,
	creator: 2,
	empire: 3,
};

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
];

function BillingPage() {
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const { refetch } = authClient.useSession();
	const checkoutRefreshDone = useRef(false);

	const { session } = useDashboardRouteContext();
	const user = session.user;
	const [loadingSlug, setLoadingSlug] = useState<string | null>(null);
	const [portalLoading, setPortalLoading] = useState(false);

	const userPlan = user.plan as MeResponse["plan"];
	const userRank = PLAN_RANK[userPlan] ?? 0;
	const hasPaidPlan = userPlan !== "free";

	/** One DB-backed session load after Polar redirects here (webhook may lag cookie cache). */
	useEffect(() => {
		if (search.checkout !== "success" || checkoutRefreshDone.current) {
			return
		}
		checkoutRefreshDone.current = true;
		void refetch({ query: { disableCookieCache: true } }).finally(() => {
			void navigate({
				search: (prev) => {
					const { checkout: _c, ...rest } = prev;
					return rest
				},
				replace: true,
			})
		})
	}, [search.checkout, refetch, navigate]);

	const runCheckout = async (slug: string) => {
		setLoadingSlug(slug);
		try {
			await authClient.checkout({ slug });
		} finally {
			setLoadingSlug(null);
		}
	}

	const openPortal = async () => {
		setPortalLoading(true);
		try {
			const res = await authClient.customer.portal({ redirect: false });
			if (res.error) {
				toast.error("Couldn’t open portal", {
					description: res.error.message ?? "Try again in a moment.",
				})
				return
			}
			const url = res.data?.url;
			if (url) {
				window.open(url, "_blank", "noopener,noreferrer");
			}
		} finally {
			setPortalLoading(false);
		}
	}

	const credits = user.creditsRemaining ?? 0;

	const analyticsQuery = useQuery(analyticsQueryOptions);

	const currentMonth = new Date().toLocaleString(undefined, {
		month: "long",
	})
	const videosThisMonth = analyticsQuery.data?.totalCompleted ?? null;

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
						const Icon = tier.icon;
						const isCurrent = userPlan === tier.slug;
						const tierRank = PLAN_RANK[tier.slug];
						const loading = loadingSlug === tier.slug;

						let cta: string
						if (isCurrent) {
							cta = "Your plan"
						} else if (userRank === 0) {
							cta = `Get ${tier.title}`;
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
										onClick={() => void runCheckout(tier.slug)}
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
							onPurchase={() => void runCheckout("credits-1k")}
						/>
						<CreditPackCard
							label="Large pack"
							amount={CREDIT_ADDON_AMOUNTS.large}
							loading={loadingSlug === "credits-3k"}
							disabled={loadingSlug !== null}
							onPurchase={() => void runCheckout("credits-3k")}
							emphasis
						/>
					</div>
				</section>
			) : null}

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
		</div>
	)
}

function CreditPackCard({
	label,
	amount,
	loading,
	disabled,
	onPurchase,
	emphasis,
}: {
	label: string;
	amount: number;
	loading: boolean;
	disabled: boolean;
	onPurchase: () => void;
	emphasis?: boolean;
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
