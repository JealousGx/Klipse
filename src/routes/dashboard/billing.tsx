import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink, Loader2 } from "lucide-react";
import { useState } from "react";

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
import {
	CREDIT_ADDON_AMOUNTS,
	MONTHLY_CREDITS_BY_PLAN,
} from "@/features/billing/tier-config";
import type { MeResponse } from "@/features/user/types/me";
import { authClient } from "@/lib/auth/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/billing")({
	staticData: { dashboardTitle: "Billing" },
	component: BillingPage,
});

const planLabel: Record<MeResponse["plan"], string> = {
	free: "Free",
	starter: "Starter",
	creator: "Creator",
	empire: "Empire",
};

const subscriptionSlugs = [
	{
		slug: "starter" as const,
		title: "Starter",
		price: "$19/mo",
		blurb: "~40 shorts / mo internal budget.",
	},
	{
		slug: "creator" as const,
		title: "Creator",
		price: "$49/mo",
		blurb: "~200 shorts / mo internal budget.",
	},
	{
		slug: "empire" as const,
		title: "Empire",
		price: "$99/mo",
		blurb: "Highest tier; long-form & priority (when shipped).",
	},
];

function BillingPage() {
	const { session } = useDashboardRouteContext();
	const user = session.user;
	const [loadingSlug, setLoadingSlug] = useState<string | null>(null);
	const [portalLoading, setPortalLoading] = useState(false);

	const runCheckout = async (slug: string) => {
		setLoadingSlug(slug);
		try {
			await authClient.checkout({ slug });
		} finally {
			setLoadingSlug(null);
		}
	};

	const openPortal = async () => {
		setPortalLoading(true);
		try {
			await authClient.customer.portal();
		} finally {
			setPortalLoading(false);
		}
	};

	return (
		<div className="space-y-10">
			<section>
				<p className="text-sm text-muted-foreground">
					Current plan:{" "}
					<span className="font-medium text-foreground">
						{planLabel[user.plan as MeResponse["plan"]]}
					</span>
					{" · "}
					{user.creditsRemaining} credits remaining (internal metering).
				</p>
				<p className="mt-2 max-w-2xl text-sm text-muted-foreground">
					Checkout and customer portal run through Polar (via Better Auth).
					Configure product IDs in your environment; successful payments sync
					plan and credits.
				</p>
			</section>

			<section className="grid gap-6 md:grid-cols-3">
				{subscriptionSlugs.map((tier) => (
					<Card
						key={tier.slug}
						className="flex flex-col border-border/80 bg-muted/10"
					>
						<CardHeader>
							<CardTitle className="font-heading text-lg">
								{tier.title}
							</CardTitle>
							<CardDescription>{tier.price}</CardDescription>
						</CardHeader>
						<CardContent className="flex-1">
							<p className="text-sm text-muted-foreground">{tier.blurb}</p>
							<p className="mt-3 text-xs text-muted-foreground">
								~{MONTHLY_CREDITS_BY_PLAN[tier.slug]} credits / period
								(internal).
							</p>
						</CardContent>
						<CardFooter>
							<Button
								type="button"
								className="w-full"
								disabled={loadingSlug !== null}
								onClick={() => void runCheckout(tier.slug)}
							>
								{loadingSlug === tier.slug ? (
									<Loader2 className="size-4 animate-spin" />
								) : (
									`Choose ${tier.title}`
								)}
							</Button>
						</CardFooter>
					</Card>
				))}
			</section>

			<section>
				<h2 className="font-heading text-base font-semibold text-foreground">
					Credit packs
				</h2>
				<p className="mt-1 text-sm text-muted-foreground">
					One-time credit top-ups (requires matching Polar products in env).
				</p>
				<div className="mt-4 flex flex-wrap gap-3">
					<Button
						type="button"
						variant="outline"
						disabled={loadingSlug !== null}
						onClick={() => void runCheckout("credits-1k")}
					>
						{loadingSlug === "credits-1k" ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							`+${CREDIT_ADDON_AMOUNTS.small.toLocaleString()} credits (small pack)`
						)}
					</Button>
					<Button
						type="button"
						variant="outline"
						disabled={loadingSlug !== null}
						onClick={() => void runCheckout("credits-3k")}
					>
						{loadingSlug === "credits-3k" ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							`+${CREDIT_ADDON_AMOUNTS.large.toLocaleString()} credits (large pack)`
						)}
					</Button>
				</div>
			</section>

			<section
				className={cn(
					"rounded-xl border border-border/70 bg-muted/15 p-4",
					"flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
				)}
			>
				<div>
					<p className="text-sm font-medium text-foreground">Customer portal</p>
					<p className="text-xs text-muted-foreground">
						Manage subscription, invoices, and payment method in Polar.
					</p>
				</div>
				<Button
					type="button"
					variant="secondary"
					disabled={portalLoading}
					onClick={() => void openPortal()}
				>
					{portalLoading ? (
						<Loader2 className="size-4 animate-spin" />
					) : (
						<>
							Open portal
							<ExternalLink className="ml-2 size-4 opacity-80" />
						</>
					)}
				</Button>
			</section>
		</div>
	);
}
