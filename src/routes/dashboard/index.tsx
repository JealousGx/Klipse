import { createFileRoute } from "@tanstack/react-router";

import { useDashboardRouteContext } from "@/context/useDashboardRouteContext";
import type { MeResponse } from "@/features/user/types/me";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/")({
	staticData: { dashboardTitle: "Overview" },
	component: DashboardPage,
});

const planLabel: Record<MeResponse["plan"], string> = {
	free: "Free",
	starter: "Starter",
	creator: "Creator",
	empire: "Empire",
};

/** Vertical accent bars + label tints from theme (`styles.css` tokens). */
const metricAccents = [
	{ bar: "bg-primary", label: "text-primary" },
	{ bar: "bg-chart-2", label: "text-chart-2" },
	{ bar: "bg-chart-1", label: "text-chart-1" },
	{ bar: "bg-muted-foreground/45", label: "text-muted-foreground" },
] as const;

function DashboardPage() {
	const { session } = useDashboardRouteContext();
	const user = session.user;

	const items = [
		{
			label: "Credits remaining",
			value: String(user.creditsRemaining),
			hint: "Ready to spend",
		},
		{
			label: "Plan",
			value: planLabel[user.plan as MeResponse["plan"]],
			hint: "Current tier",
		},
		{
			label: "Credits used",
			value: String(user.creditsUsed),
			hint: "All-time",
		},
		{
			label: "Channels",
			value: "—",
			hint: "Connected workspaces",
		},
	] as const;

	return (
		<div>
			<div className="overflow-hidden rounded-2xl border border-border/70 bg-muted/20 dark:bg-muted/10">
				<div className="grid grid-cols-1 divide-y divide-border/70 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
					{items.map((item, i) => (
						<Metric
							key={item.label}
							accent={metricAccents[i] ?? metricAccents[3]}
							{...item}
						/>
					))}
				</div>
			</div>
			<p className="mt-12 max-w-2xl border-l-2 border-primary/35 pl-5 text-sm leading-relaxed text-muted-foreground">
				Channel and job activity will show up here as those APIs land. Plan and
				credits stay aligned with billing.
			</p>
		</div>
	);
}

function Metric({
	label,
	value,
	hint,
	accent,
}: {
	label: string;
	value: string;
	hint?: string;
	accent: (typeof metricAccents)[number];
}) {
	return (
		<div className="flex min-w-0 gap-4 px-5 py-6 sm:px-6 sm:py-7">
			<div
				className={cn("w-1 shrink-0 rounded-full", accent.bar)}
				aria-hidden
			/>
			<div className="min-w-0 flex-1">
				<p
					className={cn(
						"text-[11px] font-semibold uppercase tracking-[0.16em]",
						accent.label,
					)}
				>
					{label}
				</p>
				<p className="font-heading mt-2 text-3xl font-bold tabular-nums tracking-tight text-foreground md:text-4xl">
					{value}
				</p>
				{hint ? (
					<p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
				) : null}
			</div>
		</div>
	);
}
