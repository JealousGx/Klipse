import { useNavigate } from "@tanstack/react-router"

import { Button } from "@/components/ui/button"
import { Link } from "@/components/ui/link"

import { useRootRouteContext } from "@/context/useRootRouteContext"

import { cn } from "@/lib/utils"

type Variant = "header" | "hero"

const sizeMap = {
	header: "sm" as const,
	hero: "lg" as const,
}

export interface GetStartedButtonProps {
	variant: Variant
	className?: string
}

/**
 * Single entry CTA: signed-out users open signup; signed-in users go to the dashboard.
 */
export function GetStartedButton({
	variant,
	className,
}: GetStartedButtonProps) {
	const navigate = useNavigate()
	const { session } = useRootRouteContext()

	const size = sizeMap[variant]

	if (session?.user) {
		return (
			<Link to="/dashboard" size={size} className={className}>
				Dashboard
			</Link>
		)
	}

	return (
		<Button
			size={size}
			className={cn(variant === "hero" && "min-w-42 font-semibold", className)}
			onClick={() => {
				void navigate({ to: "/", search: { auth: "signup" } })
			}}
		>
			Get Started
		</Button>
	)
}
