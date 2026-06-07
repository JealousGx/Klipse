import {
	Outlet,
	useMatches,
	useNavigate,
	useRouterState,
} from "@tanstack/react-router"
import {
	BarChart3,
	CreditCard,
	LayoutDashboard,
	ListVideo,
	Menu,
	PanelLeftClose,
	Settings,
	Share2,
	Sparkles,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { FeedbackButton } from "@/components/feedback"
import { BrandLogo } from "@/components/shared/BrandLogo"
import ThemeToggle from "@/components/ThemeToggle"
import { Button } from "@/components/ui/button"
import { Link } from "@/components/ui/link"

import { siteConfig } from "@/config/site"

import { useDashboardRouteContext } from "@/context/useDashboardRouteContext"
import type { MeResponse } from "@/features/user/types/me"

import { authClient } from "@/lib/auth/client"
import { cn } from "@/lib/utils"

const nav = [
	{ to: "/dashboard", label: "Overview", icon: LayoutDashboard },
	{ to: "/dashboard/publishing", label: "Publishing", icon: Share2 },
	{ to: "/dashboard/generate", label: "Generate", icon: Sparkles },
	{ to: "/dashboard/jobs", label: "Jobs", icon: ListVideo },
	{ to: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
	{ to: "/dashboard/billing", label: "Billing", icon: CreditCard },
	{ to: "/dashboard/settings", label: "Settings", icon: Settings },
] as const

const planLabel: Record<MeResponse["plan"], string> = {
	free: "Free",
	starter: "Starter",
	creator: "Creator",
	empire: "Empire",
}

export function DashboardShell() {
	const [mobileOpen, setMobileOpen] = useState(false)
	const pathname = useRouterState({
		select: (s) => s.location.pathname,
	})
	const matches = useMatches()
	const navigate = useNavigate()
	const { session } = useDashboardRouteContext()
	const user = session.user

	const pageTitle = useMemo(() => {
		const leaf = matches[matches.length - 1]
		return leaf?.staticData?.dashboardTitle ?? "Dashboard"
	}, [matches])

	useEffect(() => {
		setMobileOpen(false)
	}, [])

	const handleSignOut = async () => {
		await authClient.signOut()
		navigate({ to: "/" })
	}

	const email = user.email

	return (
		<div className="flex min-h-screen bg-background">
			{mobileOpen ? (
				<button
					type="button"
					className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] lg:hidden"
					aria-label="Close navigation"
					onClick={() => setMobileOpen(false)}
				/>
			) : null}

			<aside
				className={cn(
					"fixed inset-y-0 left-0 z-50 flex h-dvh max-h-dvh w-[min(100vw-3rem,17.5rem)] flex-col overflow-hidden border-r border-border/80 bg-sidebar text-sidebar-foreground shadow-2xl backdrop-blur-xl transition-transform duration-200 ease-out dark:bg-sidebar/95 lg:w-60 lg:translate-x-0 lg:shadow-none",
					mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
				)}
			>
				<div className="flex h-14 items-center justify-between gap-2 border-b border-border/80 px-3 lg:h-16 lg:px-4">
					<BrandLogo
						size="lg"
						withText
						className="text-sidebar-foreground"
						to="/dashboard"
					/>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="shrink-0 text-sidebar-foreground lg:hidden"
						aria-label="Close sidebar"
						onClick={() => setMobileOpen(false)}
					>
						<PanelLeftClose className="size-5" />
					</Button>
				</div>

				<nav
					className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-3"
					aria-label="Workspace"
				>
					<p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
						Workspace
					</p>
					{nav.map((item) => {
						const Icon = item.icon
						const active =
							item.to === "/dashboard"
								? pathname === "/dashboard" || pathname === "/dashboard/"
								: pathname === item.to || pathname.startsWith(`${item.to}/`)
						return (
							<Link
								key={item.to}
								to={item.to}
								variant="ghost"
								className={cn(
									"h-auto min-h-0 justify-start gap-3 rounded-lg px-3 py-2.5 text-sm font-medium shadow-none transition-colors",
									active
										? "bg-primary/14 text-foreground ring-1 ring-primary/25 dark:bg-primary/18"
										: "text-sidebar-foreground hover:bg-primary/10 hover:text-foreground focus-visible:bg-primary/10 focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35",
								)}
								onClick={() => setMobileOpen(false)}
							>
								<Icon className="size-4.5 shrink-0 opacity-90" />
								{item.label}
							</Link>
						)
					})}
				</nav>

				<div className="border-t border-border/80 p-3">
					<FeedbackButton className="mb-2" />
					<div className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2.5 dark:bg-muted/25">
						<p className="truncate text-xs font-medium text-foreground">
							{email || "…"}
						</p>
						<p className="mt-0.5 text-[10px] text-muted-foreground">
							{`${user.plan ? planLabel[user.plan as MeResponse["plan"]] : "Free"} · ${user.creditsRemaining || 0} credits remaining`}
						</p>
					</div>
					<div className="mt-3 flex items-center gap-2">
						<ThemeToggle />
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="flex-1 border-border/80 text-xs font-medium"
							onClick={() => void handleSignOut()}
						>
							Sign out
						</Button>
					</div>
				</div>
			</aside>

			<div className="flex min-w-0 flex-1 flex-col lg:pl-60">
				<header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/80 bg-background/85 px-4 backdrop-blur-xl lg:hidden">
					<Button
						type="button"
						variant="outline"
						size="icon"
						className="border-border/80"
						aria-label="Open navigation"
						onClick={() => setMobileOpen(true)}
					>
						<Menu className="size-5" />
					</Button>
					<span className="font-heading text-sm font-semibold tracking-tight text-foreground">
						{siteConfig.name}
					</span>
				</header>

				<main className="relative flex-1 overflow-x-hidden">
					<div
						className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_95%_70%_at_50%_-22%,color-mix(in_oklch,var(--primary)_34%,transparent)_0%,color-mix(in_oklch,var(--chart-2)_12%,transparent)_45%,transparent_68%)] dark:bg-[radial-gradient(ellipse_90%_60%_at_50%_-18%,color-mix(in_oklch,var(--primary)_22%,transparent)_0%,transparent_62%)]"
						aria-hidden
					/>
					<div className="relative mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10 lg:px-8">
						<header className="mb-8 md:mb-10 lg:mb-12">
							<p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
								Workspace
							</p>
							<h1 className="font-heading mt-2 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
								{pageTitle}
							</h1>
						</header>
						<Outlet />
					</div>
				</main>
			</div>
		</div>
	)
}
