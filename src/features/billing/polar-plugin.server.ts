import "@tanstack/react-start/server-only";

import {
	checkout,
	polar,
	portal,
	usage,
	webhooks,
} from "@polar-sh/better-auth";

import { env } from "@/env";
import { getPolarSdk } from "./polar-sdk.server";
import {
	handlePolarOrderPaid,
	handlePolarSubscriptionActive,
	handlePolarSubscriptionRevoked,
} from "./polar-sync.server";

function appOrigin(): string {
	return env.SERVER_URL ?? "http://localhost:3000";
}

export function createPolarBillingPlugin() {
	const polarSdk = getPolarSdk();

	const origin = appOrigin();

	const products = [
		{
			productId: env.POLAR_PRODUCT_STARTER,
			slug: "starter",
		},
		{
			productId: env.POLAR_PRODUCT_CREATOR,
			slug: "creator",
		},
		{
			productId: env.POLAR_PRODUCT_EMPIRE,
			slug: "empire",
		},
		{
			productId: env.POLAR_PRODUCT_CREDITS,
			slug: "credits-1k",
		},
		{
			productId: env.POLAR_PRODUCT_CREDITS_LARGE,
			slug: "credits-3k",
		},
	];

	return polar({
		client: polarSdk,
		createCustomerOnSignUp: false,
		use: [
			checkout({
				products,
				successUrl: `${origin}/dashboard/billing?checkout=success`,
				returnUrl: origin,
				authenticatedUsersOnly: true,
			}),
			portal({
				returnUrl: origin,
			}),
			usage({
				creditProducts: [
					{ productId: env.POLAR_PRODUCT_CREDITS, slug: "credits-1k" },
					{ productId: env.POLAR_PRODUCT_CREDITS_LARGE, slug: "credits-3k" },
				],
			}),
			webhooks({
				secret: env.POLAR_WEBHOOK_SECRET,
				onSubscriptionActive: handlePolarSubscriptionActive,
				onOrderPaid: handlePolarOrderPaid,
				onSubscriptionRevoked: handlePolarSubscriptionRevoked,
			}),
		],
	});
}
