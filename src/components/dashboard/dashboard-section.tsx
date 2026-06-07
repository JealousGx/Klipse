import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

type Props = {
	id?: string
	/** For `aria-labelledby` on landmark sections (e.g. `#connection`). */
	titleId?: string
	title: string
	description?: ReactNode
	children: ReactNode
	className?: string
	/** Omit top border / extra padding (first block on the page after the hero). */
	isFirst?: boolean
	tabIndex?: number
}

/**
 * Shared dashboard block: matches Settings (`border-t`, `pt-10`) and Jobs heading rhythm.
 */
export function DashboardSection({
	id,
	titleId,
	title,
	description,
	children,
	className,
	isFirst = false,
	tabIndex,
}: Props) {
	return (
		<section
			id={id}
			className={cn(
				!isFirst && "border-t border-border/70 pt-10",
				"space-y-5",
				className,
			)}
			aria-labelledby={titleId ?? undefined}
			tabIndex={tabIndex}
		>
			<div className="space-y-1.5">
				<h3
					id={titleId ?? undefined}
					className="font-heading text-lg font-semibold tracking-tight text-foreground"
				>
					{title}
				</h3>
				{description ? (
					<div className="max-w-prose text-sm leading-relaxed text-muted-foreground">
						{description}
					</div>
				) : null}
			</div>
			{children}
		</section>
	)
}
