import {
	createFileRoute,
	Link,
	notFound,
	Outlet,
	useRouterState,
} from "@tanstack/react-router";
import {
	Activity,
	BarChart3,
	ChevronRight,
	KeyRound,
	LayoutDashboard,
	LogOut,
	Settings,
	Shield,
	Users,
	Video,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { BrandLogo } from "@/components/shared/BrandLogo";
import { checkAndPromoteAdminFn } from "@/features/admin/admin-promote.functions";
import { authClient } from "@/lib/auth/client";

export const Route = createFileRoute("/_authed/admin")({
	// Security: any visitor who is not an authenticated admin gets a 404 —
	// indistinguishable from a non-existent route. The /admin path is never
	// linked from the main application. In production, additionally restrict
	// this path via Cloudflare Access or an IP allowlist at the edge.
	beforeLoad: async ({ context }) => {
		const session = context.session;

		const currentRole = (session.user as { role?: string }).role ?? "user";

		// If not already admin, check if their email qualifies for auto-promotion
		// (ADMIN_EMAILS env var — bootstrap-only mechanism).
		if (currentRole !== "admin") {
			const promoted = await checkAndPromoteAdminFn({
				data: {
					userId: session.user.id,
					email: session.user.email,
					currentRole,
				},
			});
			if (!promoted) throw notFound();
		}

		return { session };
	},
	component: AdminLayout,
});

// ---------------------------------------------------------------------------
// Nav config
// ---------------------------------------------------------------------------

const nav = [
	{ to: "/admin/keys", label: "API Keys", icon: KeyRound },
	{ to: "/admin/users", label: "Users", icon: Users },
	{ to: "/admin/jobs", label: "Jobs", icon: Video },
	{ to: "/admin/system", label: "System", icon: BarChart3 },
	{ to: "/admin/settings", label: "Settings", icon: Settings },
] as const;

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

function AdminLayout() {
	const { session } = Route.useRouteContext();
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const [isSigningOut, setIsSigningOut] = useState(false);
	const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

	const handleSignOut = async () => {
		setIsSigningOut(true);
		try {
			await authClient.signOut();
			window.location.href = "/";
		} catch {
			toast.error("Sign out failed.");
			setIsSigningOut(false);
		}
	};

	const userName = session.user.name || session.user.email;

	return (
		<div className="dark flex min-h-dvh bg-zinc-950 text-zinc-100">
			{/* ── Sidebar ─────────────────────────────────────────────────────── */}
			<aside
				className={[
					"fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-zinc-800/80 bg-zinc-950 transition-transform lg:static lg:translate-x-0",
					mobileSidebarOpen ? "translate-x-0" : "-translate-x-full",
				].join(" ")}
			>
				{/* Logo / brand */}
				<div className="flex h-16 shrink-0 items-center gap-3 border-b border-zinc-800/80 px-6">
					<BrandLogo size="sm" withText />
					<div className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5">
						<Shield className="size-2.5 text-primary" />
						<span className="text-[9px] font-semibold uppercase tracking-widest text-primary/80">
							Admin
						</span>
					</div>
				</div>

				{/* Nav */}
				<nav className="flex-1 overflow-y-auto px-3 py-4">
					<p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
						Operations
					</p>
					<ul className="space-y-0.5">
						{nav.map(({ to, label, icon: Icon }) => {
							const isActive = pathname === to || pathname.startsWith(`${to}/`);
							return (
								<li key={to}>
									<Link
										to={to}
										onClick={() => setMobileSidebarOpen(false)}
										className={[
											"group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
											isActive
												? "bg-primary/15 text-primary shadow-sm"
												: "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100",
										].join(" ")}
									>
										<Icon
											className={[
												"size-4 shrink-0 transition-colors",
												isActive
													? "text-primary"
													: "text-zinc-500 group-hover:text-zinc-300",
											].join(" ")}
										/>
										{label}
										{isActive && (
											<ChevronRight className="ml-auto size-3.5 text-primary/60" />
										)}
									</Link>
								</li>
							);
						})}
					</ul>
				</nav>

				{/* Footer */}
				<div className="shrink-0 border-t border-zinc-800/80 p-4 space-y-2">
					{/* Back to app */}
					<Link
						to="/dashboard"
						className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-zinc-500 transition-colors hover:bg-zinc-800/60 hover:text-zinc-300"
					>
						<LayoutDashboard className="size-3.5" />
						Back to app
					</Link>
					{/* Current user */}
					<div className="flex items-center gap-3 rounded-lg bg-zinc-900/60 px-3 py-2.5">
						<div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary">
							{userName.charAt(0).toUpperCase()}
						</div>
						<div className="min-w-0 flex-1">
							<p className="truncate text-xs font-medium text-zinc-200">
								{userName}
							</p>
							<p className="text-[10px] text-primary/70">Admin</p>
						</div>
						<button
							type="button"
							onClick={() => void handleSignOut()}
							disabled={isSigningOut}
							className="shrink-0 text-zinc-500 transition-colors hover:text-red-400 disabled:opacity-50"
							title="Sign out"
						>
							<LogOut className="size-3.5" />
						</button>
					</div>
				</div>
			</aside>

			{/* ── Mobile overlay ───────────────────────────────────────────────── */}
			{mobileSidebarOpen && (
				<div
					className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
					onClick={() => setMobileSidebarOpen(false)}
					aria-hidden
				/>
			)}

			{/* ── Main content ─────────────────────────────────────────────────── */}
			<div className="flex min-w-0 flex-1 flex-col">
				{/* Mobile topbar */}
				<header className="flex h-14 shrink-0 items-center gap-4 border-b border-zinc-800/80 bg-zinc-950/95 px-4 backdrop-blur lg:hidden">
					<button
						type="button"
						onClick={() => setMobileSidebarOpen(true)}
						className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
						aria-label="Open menu"
					>
						<Activity className="size-5" />
					</button>
					<BrandLogo size="sm" withText />
				</header>

				{/* Page area */}
				<main className="flex-1 overflow-auto bg-zinc-900/40 p-6 lg:p-8">
					<Outlet />
				</main>
			</div>
		</div>
	);
}
