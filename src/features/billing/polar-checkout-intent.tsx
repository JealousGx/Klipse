import { useEffect, useRef } from "react"
import { toast } from "sonner"

import { authClient } from "@/lib/auth/client"
import {
	isPolarCheckoutSlug,
	type PolarCheckoutSlug,
} from "@/lib/billing/polar-checkout-slugs"

const STORAGE_KEY = "klipse.polarCheckout"

export function setPolarCheckoutIntent(slug: PolarCheckoutSlug): void {
	sessionStorage.setItem(STORAGE_KEY, slug)
}

/**
 * After login/signup, run Polar checkout if the user chose a plan on the landing page first.
 * Mounted under `/dashboard` only.
 */
export function PolarCheckoutIntent() {
	const ran = useRef(false)

	useEffect(() => {
		if (ran.current) {
			return
		}
		const raw = sessionStorage.getItem(STORAGE_KEY)
		if (!raw || !isPolarCheckoutSlug(raw)) {
			if (raw) {
				sessionStorage.removeItem(STORAGE_KEY)
			}
			return
		}
		ran.current = true
		sessionStorage.removeItem(STORAGE_KEY)
		const slug = raw
		toast.info("Opening Polar checkout…", {
			description: "You’ll complete payment on Polar’s secure page.",
			duration: 6000,
		})
		void authClient.checkout({ slug }).catch((err: unknown) => {
			const message =
				err instanceof Error ? err.message : "Checkout could not start."
			toast.error("Checkout failed", { description: message })
		})
	}, [])

	return null
}
