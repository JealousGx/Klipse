import { createFileRoute, Link } from "@tanstack/react-router";
import { LogOut, Settings } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { DashboardPanel } from "@/components/dashboard/dashboard-panel";
import { DashboardSection } from "@/components/dashboard/dashboard-section";
import { Button } from "@/components/ui/button";
import { useDashboardRouteContext } from "@/context/useDashboardRouteContext";
import type { MeResponse } from "@/features/user/types/me";
import { authClient } from "@/lib/auth/client";

export const Route = createFileRoute("/dashboard/settings")({
	staticData: { dashboardTitle: "Settings" },
	component: SettingsPage,
});

const planLabel: Record<MeResponse["plan"], string> = {
	free: "Free",
	starter: "Starter",
	creator: "Creator",
	empire: "Empire",
};

const fieldClass =
	"w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none ring-offset-2 transition focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

function SettingsPage() {
	const { session } = useDashboardRouteContext();
	const user = session.user;
	const { refetch: refetchSession } = authClient.useSession();

	const [name, setName] = useState(user.name ?? "");
	const [isSavingName, setIsSavingName] = useState(false);
	const [isSigningOut, setIsSigningOut] = useState(false);

	const handleSaveName = async () => {
		const trimmed = name.trim();
		if (!trimmed || trimmed === (user.name ?? "")) return;
		setIsSavingName(true);
		try {
			await authClient.updateUser({ name: trimmed });
			await refetchSession({ query: { disableCookieCache: true } });
			toast.success("Name updated");
		} catch {
			toast.error("Could not save name. Please try again.");
		} finally {
			setIsSavingName(false);
		}
	};

	const handleSignOut = async () => {
		setIsSigningOut(true);
		try {
			await authClient.signOut();
			window.location.href = "/";
		} catch {
			toast.error("Sign out failed. Please try again.");
			setIsSigningOut(false);
		}
	};

	return (
		<div className="w-full space-y-8 pb-4 lg:space-y-10">
			{/* Hero */}
			<div className="relative overflow-hidden rounded-2xl border border-border/70 bg-linear-to-br from-primary/9 via-background to-chart-2/7 dark:from-primary/12 dark:to-chart-2/10">
				<div
					className="pointer-events-none absolute -right-24 -top-24 size-64 rounded-full bg-primary/8 blur-3xl dark:bg-primary/12"
					aria-hidden
				/>
				<div className="relative flex items-center gap-4 p-6 lg:p-8">
					<div className="flex size-12 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary/10">
						<Settings className="size-5 text-primary" />
					</div>
					<div>
						<div className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
							Account settings
						</div>
						<h2 className="font-heading mt-1 text-xl font-semibold tracking-tight text-foreground md:text-2xl">
							{user.name || user.email}
						</h2>
						<p className="text-sm text-muted-foreground">
							{planLabel[(user.plan ?? "free") as MeResponse["plan"]]} plan
						</p>
					</div>
				</div>
			</div>

			{/* Profile section */}
			<DashboardSection
				id="profile"
				titleId="profile-heading"
				title="Profile"
				description="Your name is shown in Klipse and on notifications."
				isFirst
			>
				<DashboardPanel variant="emphasis">
					<div className="space-y-5">
						{/* Name */}
						<div className="space-y-2">
							<label
								htmlFor="settings-name"
								className="text-sm font-medium text-foreground"
							>
								Name
							</label>
							<div className="flex gap-3">
								<input
									id="settings-name"
									type="text"
									className={fieldClass}
									value={name}
									onChange={(e) => setName(e.target.value)}
									placeholder="Your name"
									disabled={isSavingName}
								/>
								<Button
									type="button"
									size="sm"
									disabled={
										isSavingName ||
										!name.trim() ||
										name.trim() === (user.name ?? "")
									}
									onClick={() => void handleSaveName()}
								>
									{isSavingName ? "Saving…" : "Save"}
								</Button>
							</div>
						</div>

						{/* Email — read-only */}
						<div className="space-y-1.5">
							<p className="text-sm font-medium text-foreground">Email</p>
							<p className="text-sm text-muted-foreground">{user.email}</p>
							<p className="text-xs text-muted-foreground">
								Email cannot be changed here. Contact support if needed.
							</p>
						</div>

						{/* Plan */}
						<div className="flex items-center justify-between gap-4">
							<div className="space-y-1">
								<p className="text-sm font-medium text-foreground">Plan</p>
								<p className="text-sm text-muted-foreground">
									{planLabel[(user.plan ?? "free") as MeResponse["plan"]]}
								</p>
							</div>
							<Button type="button" variant="outline" size="sm" asChild>
								<Link to="/dashboard/billing">Manage plan</Link>
							</Button>
						</div>
					</div>
				</DashboardPanel>
			</DashboardSection>

			{/* Notifications — coming soon */}
			<DashboardSection
				id="notifications"
				titleId="notifications-heading"
				title="Notifications"
				description="Control when Klipse sends you emails."
			>
				<DashboardPanel>
					<div className="space-y-4">
						<NotificationRow
							label="Video needs your approval"
							description="Sent when a video is ready and the channel is set to ask-first."
							comingSoon
						/>
						<NotificationRow
							label="Video is ready"
							description="Sent when a video finishes generating and is ready to review."
							comingSoon
						/>
					</div>
				</DashboardPanel>
			</DashboardSection>

			{/* Danger zone */}
			<DashboardSection
				id="account"
				titleId="account-heading"
				title="Account"
				description="Sign out or delete your account."
			>
				<DashboardPanel variant="danger">
					<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<p className="text-sm font-medium text-foreground">Sign out</p>
							<p className="text-xs text-muted-foreground">
								You will be redirected to the sign-in page.
							</p>
						</div>
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="gap-2 self-start border-destructive/40 text-destructive hover:bg-destructive/10 sm:self-auto"
							disabled={isSigningOut}
							onClick={() => void handleSignOut()}
						>
							<LogOut className="size-3.5" />
							{isSigningOut ? "Signing out…" : "Sign out"}
						</Button>
					</div>
					<div className="mt-4 border-t border-destructive/20 pt-4">
						<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
							<div>
								<p className="text-sm font-medium text-foreground">
									Delete account
								</p>
								<p className="text-xs text-muted-foreground">
									Permanently deletes all your data. Contact support to
									request deletion.
								</p>
							</div>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="self-start text-xs text-muted-foreground sm:self-auto"
								disabled
							>
								Contact support
							</Button>
						</div>
					</div>
				</DashboardPanel>
			</DashboardSection>
		</div>
	);
}

function NotificationRow({
	label,
	description,
	comingSoon,
}: {
	label: string;
	description: string;
	comingSoon?: boolean;
}) {
	return (
		<div className="flex items-start justify-between gap-4">
			<div>
				<p className="text-sm font-medium text-foreground">{label}</p>
				<p className="text-xs text-muted-foreground">{description}</p>
			</div>
			{comingSoon ? (
				<span className="shrink-0 rounded-full border border-border bg-muted/60 px-2.5 py-1 text-xs font-medium text-muted-foreground">
					Soon
				</span>
			) : null}
		</div>
	);
}
