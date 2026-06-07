"use client"

import { useEffect, useState } from "react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

import { cn } from "@/lib/utils"

/**
 * Theme must not be read from `document` during the first render: the inline
 * theme bootstrap in `__root.tsx` runs before hydration, so `classList` can
 * differ from what SSR assumed and `useSyncExternalStore` would mismatch.
 * Initial render uses `"light"` on server and client; `useEffect` syncs after mount.
 */
export function Toaster(props: ToasterProps) {
	const [theme, setTheme] = useState<"light" | "dark">("light")

	useEffect(() => {
		const sync = () => {
			setTheme(
				document.documentElement.classList.contains("dark") ? "dark" : "light",
			)
		}
		sync()
		const el = document.documentElement
		const observer = new MutationObserver(sync)
		observer.observe(el, { attributes: true, attributeFilter: ["class"] })
		return () => observer.disconnect()
	}, [])

	return (
		<Sonner
			{...props}
			theme={theme}
			richColors
			className={cn("toaster group", props.className)}
			position={props.position ?? "top-center"}
			closeButton={props.closeButton ?? true}
		/>
	)
}
