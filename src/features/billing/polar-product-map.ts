import { env } from "@/env"

import { CREDIT_ADDON_AMOUNTS, MONTHLY_CREDITS_BY_PLAN } from "./tier-config"

export type AppPlan = keyof typeof MONTHLY_CREDITS_BY_PLAN

/** Maps Polar product IDs (from env) → subscription tier. Names follow .env.example (BASIC/PRO/AGENCY). */
export function polarProductToPlan(productId: string): AppPlan | null {
	if (env.POLAR_PRODUCT_STARTER && productId === env.POLAR_PRODUCT_STARTER) {
		return "starter"
	}
	if (env.POLAR_PRODUCT_CREATOR && productId === env.POLAR_PRODUCT_CREATOR) {
		return "creator"
	}
	if (env.POLAR_PRODUCT_EMPIRE && productId === env.POLAR_PRODUCT_EMPIRE) {
		return "empire"
	}
	return null
}

export function monthlyCreditsForPlan(plan: AppPlan): number {
	return MONTHLY_CREDITS_BY_PLAN[plan]
}

/** One-time credit pack size for a Polar product, or null if unknown. */
export function polarProductToCreditAddon(productId: string): number | null {
	if (env.POLAR_PRODUCT_CREDITS && productId === env.POLAR_PRODUCT_CREDITS) {
		return CREDIT_ADDON_AMOUNTS.small
	}
	if (
		env.POLAR_PRODUCT_CREDITS_LARGE &&
		productId === env.POLAR_PRODUCT_CREDITS_LARGE
	) {
		return CREDIT_ADDON_AMOUNTS.large
	}
	return null
}
