"use client";

import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";

import { useRootRouteContext } from "@/context/useRootRouteContext";

import { setPolarCheckoutIntent } from "@/features/billing/polar-checkout-intent";

import { authClient } from "@/lib/auth/client";
import type { PolarCheckoutSlug } from "@/lib/billing/polar-checkout-slugs";
import { cn } from "@/lib/utils";

export type PricingTierCtaProps = {
	emphasis: boolean;
	ctaLabel: string;
	/** When set, triggers Polar checkout for this slug. When omitted (Free tier), only signup. */
	checkoutSlug?: PolarCheckoutSlug;
	className?: string;
};

export function PricingTierCta({
	emphasis,
	ctaLabel,
	checkoutSlug,
	className,
}: PricingTierCtaProps) {
	const navigate = useNavigate();
	const { session } = useRootRouteContext();
	const [loading, setLoading] = useState(false);

	if (!checkoutSlug) {
		return (
			<Link
				to="/"
				search={{ auth: "signup" }}
				variant={emphasis ? "default" : "outline"}
				size="lg"
				className={cn("w-full font-semibold", className)}
			>
				{ctaLabel}
			</Link>
		);
	}

	const runCheckout = async () => {
		setLoading(true);
		try {
			await authClient.checkout({ slug: checkoutSlug });
		} finally {
			setLoading(false);
		}
	};

	const goSignupWithIntent = () => {
		setPolarCheckoutIntent(checkoutSlug);
		void navigate({ to: "/", search: { auth: "signup" } });
	};

	if (session?.user) {
		return (
			<Button
				type="button"
				size="lg"
				variant={emphasis ? "default" : "outline"}
				className={cn("w-full font-semibold", className)}
				disabled={loading}
				onClick={() => void runCheckout()}
			>
				{loading ? (
					<Loader2 className="size-4 animate-spin" aria-hidden />
				) : (
					ctaLabel
				)}
			</Button>
		);
	}

	return (
		<Button
			type="button"
			size="lg"
			variant={emphasis ? "default" : "outline"}
			className={cn("w-full font-semibold", className)}
			onClick={goSignupWithIntent}
		>
			{ctaLabel}
		</Button>
	);
}
