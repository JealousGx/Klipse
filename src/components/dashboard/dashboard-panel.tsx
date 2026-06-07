import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

type Variant = "default" | "emphasis" | "danger" | "muted"

type Props = {
	children: ReactNode
	className?: string
	variant?: Variant
}

/**
 * Light surface for grouped controls — softer than stacked `Card`s, consistent with
 * Generate inline messages (`rounded-lg border bg-muted/30`).
 */
export function DashboardPanel({
	children,
	className,
	variant = "default",
}: Props) {
	return (
		<div
			className={cn(
				"rounded-xl border px-5 py-5 md:px-6 md:py-6",
				variant === "default" &&
					"border-border/70 bg-card/40 shadow-sm dark:bg-card/25",
				variant === "muted" && "border-border/60 bg-muted/15 dark:bg-muted/10",
				variant === "emphasis" &&
					"border-primary/25 bg-gradient-to-br from-primary/[0.07] via-transparent to-transparent shadow-sm dark:border-primary/35 dark:from-primary/[0.1]",
				variant === "danger" &&
					"border-destructive/25 bg-destructive/[0.04] shadow-sm dark:bg-destructive/[0.08]",
				className,
			)}
		>
			{children}
		</div>
	)
}
