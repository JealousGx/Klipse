import { createFileRoute } from "@tanstack/react-router";

import { useDashboardRouteContext } from "@/context/useDashboardRouteContext";
import type { MeResponse } from "@/features/user/types/me";

const planLabel: Record<MeResponse["plan"], string> = {
	free: "Free",
	starter: "Starter",
	creator: "Creator",
	empire: "Empire",
};

export const Route = createFileRoute("/dashboard/settings")({
	staticData: { dashboardTitle: "Settings" },
	component: SettingsPage,
});

function SettingsPage() {
	const { session } = useDashboardRouteContext();
	const user = session.user;

	return (
		<div className="space-y-10">
			<section className="max-w-xl space-y-3">
				<h2 className="font-heading text-lg font-semibold tracking-tight text-foreground">
					Profile
				</h2>
				<p className="text-sm text-muted-foreground">
					Basic account details from your Better Auth session.
				</p>
				<dl className="space-y-3 border-t border-border/70 pt-5 text-sm">
					<div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
						<dt className="text-muted-foreground">Email</dt>
						<dd className="font-medium text-foreground">{user.email}</dd>
					</div>
					<div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
						<dt className="text-muted-foreground">Name</dt>
						<dd className="font-medium text-foreground">{user.name ?? "—"}</dd>
					</div>
					<div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
						<dt className="text-muted-foreground">Plan</dt>
						<dd className="font-medium text-foreground">
							{planLabel[user.plan as MeResponse["plan"]]}
						</dd>
					</div>
				</dl>
			</section>

			<section className="max-w-xl space-y-3 border-t border-border/70 pt-10">
				<h2 className="font-heading text-lg font-semibold tracking-tight text-foreground">
					Preferences
				</h2>
				<p className="text-sm text-muted-foreground">
					Notifications, defaults, and connected accounts will live here in a
					follow-up.
				</p>
			</section>
		</div>
	);
}
