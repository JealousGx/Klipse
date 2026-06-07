import { Link } from "@tanstack/react-router"
import { Check, X } from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import type { ChannelRow } from "@/features/channels/channels.service.server"

import { cn } from "@/lib/utils"

const STORAGE_KEY = "klipse_onboarding_dismissed"

type Step = {
	label: string
	description: string
	done: boolean
	href: string
	cta: string
}

type Props = {
	channels: ChannelRow[]
}

function getSteps(channels: ChannelRow[]): Step[] {
	const hasChannel = channels.length > 0
	const hasOAuth = channels.some((c) => c.oauthConnected)
	const hasNiche = channels.some((c) => c.niche.trim().length > 0)

	return [
		{
			label: "Connect a platform account",
			description:
				"Link your YouTube channel so Klipse can publish videos for you.",
			done: hasOAuth,
			href: "/dashboard/publishing",
			cta: "Go to Publishing",
		},
		{
			label: "Set your niche and posting schedule",
			description:
				"Tell Klipse what your channel is about and how often to post.",
			done: hasChannel && hasNiche,
			href: "/dashboard/publishing",
			cta: "Open channel settings",
		},
		{
			label: "You're live — sit back",
			description:
				"Klipse will auto-generate and post videos on your schedule. Use Generate to create one right now.",
			done: hasOAuth && hasNiche,
			href: "/dashboard/generate",
			cta: "Create a video now",
		},
	]
}

function isDismissed(): boolean {
	if (typeof window === "undefined") return false
	return localStorage.getItem(STORAGE_KEY) === "1"
}

export function OnboardingChecklist({ channels }: Props) {
	const [dismissed, setDismissed] = useState(true)

	useEffect(() => {
		setDismissed(isDismissed())
	}, [])

	const steps = getSteps(channels)
	const completedCount = steps.filter((s) => s.done).length
	const allDone = completedCount === steps.length

	const handleDismiss = () => {
		localStorage.setItem(STORAGE_KEY, "1")
		setDismissed(true)
	}

	if (dismissed) return null

	return (
		<div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
			<div className="flex items-center justify-between gap-4 border-b border-border bg-muted/40 px-5 py-3.5">
				<div className="flex items-center gap-3">
					<span className="font-heading text-sm font-semibold text-foreground">
						Get started with Klipse
					</span>
					<span className="rounded-full border border-border bg-background px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
						{completedCount} / {steps.length} complete
					</span>
				</div>
				<button
					type="button"
					onClick={handleDismiss}
					className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
					aria-label="Dismiss"
				>
					<X className="size-3.5" />
				</button>
			</div>

			{/* Progress bar */}
			<div className="h-1 bg-muted/50">
				<div
					className="h-full bg-primary transition-all duration-500"
					style={{ width: `${(completedCount / steps.length) * 100}%` }}
				/>
			</div>

			<div className="divide-y divide-border/70">
				{steps.map((step, i) => (
					<div
						key={step.label}
						className={cn(
							"flex items-start gap-4 px-5 py-4",
							step.done && "opacity-60",
						)}
					>
						{/* Step indicator */}
						<div
							className={cn(
								"mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
								step.done
									? "border-primary bg-primary text-primary-foreground"
									: "border-border bg-background text-muted-foreground",
							)}
						>
							{step.done ? <Check className="size-3.5" /> : i + 1}
						</div>

						{/* Content */}
						<div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
							<div>
								<p className="text-sm font-medium text-foreground">
									{step.label}
								</p>
								<p className="text-xs text-muted-foreground">
									{step.description}
								</p>
							</div>
							{!step.done && (
								<Button
									type="button"
									variant="outline"
									size="sm"
									className="mt-2 shrink-0 self-start text-xs sm:mt-0"
									asChild
								>
									<Link
										to={
											step.href as
												| "/dashboard/publishing"
												| "/dashboard/generate"
										}
									>
										{step.cta}
									</Link>
								</Button>
							)}
						</div>
					</div>
				))}
			</div>

			{allDone && (
				<div className="border-t border-border/70 bg-muted/20 px-5 py-3 text-center">
					<p className="text-sm text-muted-foreground">
						<span className="font-medium text-foreground">You're all set!</span>{" "}
						Videos will be generated and posted automatically.{" "}
						<button
							type="button"
							onClick={handleDismiss}
							className="font-medium text-primary underline-offset-4 hover:underline"
						>
							Dismiss
						</button>
					</p>
				</div>
			)}
		</div>
	)
}
