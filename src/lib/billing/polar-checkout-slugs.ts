/**
 * Checkout slugs configured in `polar-plugin.server.ts` / Polar dashboard.
 * Keep in sync with dashboard billing and landing pricing CTAs.
 */
export const POLAR_CHECKOUT_SLUGS = [
	"starter",
	"creator",
	"empire",
	"credits-1k",
	"credits-3k",
] as const;

export type PolarCheckoutSlug = (typeof POLAR_CHECKOUT_SLUGS)[number];

const slugSet = new Set<string>(POLAR_CHECKOUT_SLUGS);

export function isPolarCheckoutSlug(value: string): value is PolarCheckoutSlug {
	return slugSet.has(value);
}
