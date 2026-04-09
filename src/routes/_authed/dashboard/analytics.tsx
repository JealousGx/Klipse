import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	BarChart2,
	CheckCircle2,
	CreditCard,
	TrendingUp,
	Video,
} from "lucide-react";
import type { ReactNode } from "react";

import { analyticsQueryOptions } from "@/lib/queries/dashboard-queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authed/dashboard/analytics")({
	staticData: { dashboardTitle: "Analytics" },
	beforeLoad: ({ context }) => {
		void context.queryClient.ensureQueryData(analyticsQueryOptions);
	},
	component: AnalyticsPage,
});

function AnalyticsPage() {
	const query = useQuery(analyticsQueryOptions);
	const data = query.data;

	const currentMonth = new Date().toLocaleString(undefined, {
		month: "long",
		year: "numeric",
	})

	return (
		<div className="space-y-8">
			{/* Hero */}
			<div className="relative overflow-hidden rounded-2xl border border-border/70 bg-linear-to-br from-primary/9 via-background to-chart-2/7 dark:from-primary/12 dark:to-chart-2/10">
				<div
					className="pointer-events-none absolute -right-24 -top-24 size-64 rounded-full bg-primary/8 blur-3xl dark:bg-primary/12"
					aria-hidden
				/>
				<div className="relative flex flex-col gap-6 p-6 sm:flex-row sm:items-start sm:justify-between lg:p-8">
					<div className="space-y-2">
						<div className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
							<BarChart2 className="size-3.5" />
							Analytics
						</div>
						<h2 className="font-heading text-xl font-semibold tracking-tight text-foreground md:text-2xl">
							Your content performance
						</h2>
						<p className="text-sm text-muted-foreground">
							Based on all videos generated across your channels.
						</p>
					</div>
					<div className="flex flex-wrap gap-3">
						<GlassMetric
							icon={<Video className="size-4 text-primary" />}
							label="Videos generated"
							value={data ? String(data.totalCompleted) : "—"}
						/>
						<GlassMetric
							icon={<CheckCircle2 className="size-4 text-chart-2" />}
							label="Success rate"
							value={data ? `${data.successRate}%` : "—"}
						/>
						<GlassMetric
							icon={<CreditCard className="size-4 text-chart-1" />}
							label={`Credits · ${currentMonth}`}
							value={data ? String(data.creditsUsedThisMonth) : "—"}
						/>
					</div>
				</div>
			</div>

			{/* Per-channel breakdown */}
			<div className="space-y-3">
				<h3 className="font-heading text-sm font-semibold text-foreground">
					By channel
				</h3>
				{query.isPending ? (
					<SkeletonTable />
				) : !data || data.byChannel.length === 0 ? (
					<div className="rounded-xl border border-dashed border-border/70 bg-muted/10 px-6 py-8 text-center text-sm text-muted-foreground">
						No completed videos yet. Generate your first video to see stats
						here.
					</div>
				) : (
					<div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b border-border bg-muted/40">
									<th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
										Channel
									</th>
									<th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
										Videos
									</th>
									<th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
										Failed
									</th>
									<th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
										Rate
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-border">
								{data.byChannel.map((ch) => {
									const total = ch.completed + ch.failed;
									const rate =
										total > 0 ? Math.round((ch.completed / total) * 100) : 0;
									return (
										<tr
											key={ch.channelId}
											className="transition-colors hover:bg-muted/30"
										>
											<td className="px-4 py-3 font-medium text-foreground">
												{ch.channelName}
											</td>
											<td className="px-4 py-3 text-right tabular-nums text-foreground">
												{ch.completed}
											</td>
											<td
												className={cn(
													"px-4 py-3 text-right tabular-nums",
													ch.failed > 0
														? "text-destructive"
														: "text-muted-foreground",
												)}
											>
												{ch.failed}
											</td>
											<td className="px-4 py-3 text-right tabular-nums text-foreground">
												{rate}%
											</td>
										</tr>
									)
								})}
							</tbody>
						</table>
					</div>
				)}
			</div>

			{/* Last 30 days bar chart */}
			{data && data.last30Days.length > 0 ? (
				<div className="space-y-3">
					<h3 className="font-heading text-sm font-semibold text-foreground">
						Last 30 days
					</h3>
					<MiniBarChart rows={data.last30Days} />
				</div>
			) : null}

			{/* Coming soon — platform analytics */}
			<div className="rounded-xl border border-dashed border-border/70 bg-muted/10 px-6 py-8">
				<div className="flex items-start gap-4">
					<div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-muted/50">
						<TrendingUp className="size-4 text-muted-foreground" />
					</div>
					<div>
						<p className="text-sm font-medium text-foreground">
							YouTube views &amp; watch time — coming soon
						</p>
						<p className="mt-1 text-sm text-muted-foreground">
							Connect to the YouTube Data API to pull in view counts, watch
							time, and audience retention for your published videos.
						</p>
					</div>
				</div>
			</div>
		</div>
	)
}

function GlassMetric({
	icon,
	label,
	value,
}: {
	icon: ReactNode;
	label: string;
	value: string;
}) {
	return (
		<div className="flex min-w-36 items-start gap-3 rounded-xl border border-border/60 bg-background/80 px-4 py-3.5 shadow-sm backdrop-blur-sm">
			<div className="mt-0.5 shrink-0">{icon}</div>
			<div>
				<p className="text-xs text-muted-foreground">{label}</p>
				<p className="font-heading mt-0.5 text-2xl font-bold tabular-nums text-foreground">
					{value}
				</p>
			</div>
		</div>
	)
}

function MiniBarChart({ rows }: { rows: { date: string; count: number }[] }) {
	const max = Math.max(...rows.map((r) => r.count), 1);

	return (
		<div className="overflow-hidden rounded-xl border border-border bg-card p-4 shadow-sm">
			<div className="flex h-24 items-end gap-1">
				{rows.map((r) => (
					<div
						key={r.date}
						className="group relative flex flex-1 flex-col items-center justify-end"
					>
						<div
							className="w-full min-h-0.5 rounded-t-sm bg-primary/70 transition-colors group-hover:bg-primary"
							style={{ height: `${(r.count / max) * 100}%` }}
							title={`${r.date}: ${r.count} video${r.count !== 1 ? "s" : ""}`}
						/>
					</div>
				))}
			</div>
			<div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
				<span>{rows[0]?.date ?? ""}</span>
				<span>{rows[rows.length - 1]?.date ?? ""}</span>
			</div>
		</div>
	)
}

function SkeletonTable() {
	return (
		<div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
			<div className="h-10 animate-pulse border-b border-border bg-muted/40" />
			{[1, 2, 3].map((i) => (
				<div key={i} className="flex gap-4 border-b border-border px-4 py-3">
					<div className="h-4 w-1/3 animate-pulse rounded bg-muted/60" />
					<div className="ml-auto h-4 w-12 animate-pulse rounded bg-muted/40" />
				</div>
			))}
		</div>
	)
}
