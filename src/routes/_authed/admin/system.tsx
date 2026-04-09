import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	AlertCircle,
	BarChart3,
	CheckCircle2,
	Clock,
	Key,
	RefreshCw,
	Users,
	Video,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
	getSystemStatsFn,
	type SystemStats,
} from "@/features/admin/admin-system.functions";

export const Route = createFileRoute("/_authed/admin/system")({
	component: AdminSystemPage,
});

// ---------------------------------------------------------------------------
// Stat Card
// ---------------------------------------------------------------------------

function StatCard({
	label,
	value,
	subtitle,
	icon: Icon,
	accent,
	pulse,
}: {
	label: string;
	value: number | string;
	subtitle?: string;
	icon?: React.ElementType;
	accent?: "green" | "red" | "amber" | "blue" | "default";
	pulse?: boolean;
}) {
	const valueClass =
		accent === "green"
			? "text-emerald-400"
			: accent === "red"
				? "text-red-400"
				: accent === "amber"
					? "text-amber-400"
					: accent === "blue"
						? "text-blue-400"
						: "text-zinc-100"

	return (
		<div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
			<div className="mb-3 flex items-center justify-between">
				<p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
					{label}
				</p>
				{Icon && (
					<div className="flex size-8 items-center justify-center rounded-lg bg-zinc-800">
						<Icon className="size-4 text-zinc-400" />
					</div>
				)}
			</div>
			<div className="flex items-end gap-2">
				<p className={`text-3xl font-bold ${valueClass}`}>{value}</p>
				{pulse && typeof value === "number" && value > 0 && (
					<span className="mb-1 size-2 animate-pulse rounded-full bg-emerald-400" />
				)}
			</div>
			{subtitle && <p className="mt-1 text-xs text-zinc-500">{subtitle}</p>}
		</div>
	)
}

// ---------------------------------------------------------------------------
// Provider Health Row
// ---------------------------------------------------------------------------

function ProviderHealthRow({
	provider,
	total,
	active,
	cooling,
	disabled,
}: {
	provider: string;
	total: number;
	active: number;
	cooling: number;
	disabled: number;
}) {
	const healthPercent = total > 0 ? Math.round((active / total) * 100) : 0;
	const barColor =
		healthPercent === 100
			? "bg-emerald-500"
			: healthPercent >= 50
				? "bg-amber-500"
				: "bg-red-500";

	return (
		<div className="flex items-center gap-4 py-3">
			<div className="w-28 shrink-0">
				<p className="text-sm font-medium text-zinc-300">{provider}</p>
			</div>

			{/* Counts */}
			<div className="flex shrink-0 gap-3 text-xs">
				<span className="flex items-center gap-1 text-emerald-400">
					<span className="size-1.5 rounded-full bg-emerald-400" />
					{active} active
				</span>
				{cooling > 0 && (
					<span className="flex items-center gap-1 text-amber-400">
						<Clock className="size-3" />
						{cooling} cooling
					</span>
				)}
				{disabled > 0 && (
					<span className="flex items-center gap-1 text-zinc-500">
						{disabled} disabled
					</span>
				)}
			</div>

			{/* Health bar */}
			<div className="flex-1">
				<div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
					<div
						className={`h-full rounded-full transition-all ${barColor}`}
						style={{ width: `${healthPercent}%` }}
					/>
				</div>
			</div>

			<div className="w-10 shrink-0 text-right text-xs tabular-nums text-zinc-500">
				{healthPercent}%
			</div>
		</div>
	)
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function AdminSystemPage() {
	const { data, isLoading, isError, isFetching, refetch, dataUpdatedAt } =
		useQuery({
			queryKey: ["admin-system"],
			queryFn: () => getSystemStatsFn(),
			staleTime: 15_000,
			refetchInterval: 30_000,
		});

	const stats: SystemStats | null = data?.ok ? data.stats : null;

	const lastUpdated = dataUpdatedAt
		? new Date(dataUpdatedAt).toLocaleTimeString()
		: null;

	return (
		<div className="space-y-8">
			{/* Header */}
			<div className="flex items-start justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold text-zinc-100">System</h1>
					<p className="mt-1 text-sm text-zinc-400">
						Platform health overview and recent activity.
					</p>
				</div>
				<div className="flex shrink-0 items-center gap-3">
					{lastUpdated && (
						<span className="hidden text-xs text-zinc-500 sm:inline">
							Updated {lastUpdated}
						</span>
					)}
					<Button
						variant="outline"
						size="sm"
						onClick={() => refetch()}
						disabled={isFetching}
					>
						<RefreshCw
							className={`mr-1.5 size-4 ${isFetching ? "animate-spin" : ""}`}
						/>
						Refresh
					</Button>
				</div>
			</div>

			{/* Error state */}
			{isError || (data && !data.ok) ? (
				<div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
					<AlertCircle className="size-4 shrink-0" />
					Failed to load system stats.
				</div>
			) : null}

			{/* Loading skeleton */}
			{isLoading && (
				<div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
					{Array.from({ length: 4 }).map((_, i) => (
						<div
							// biome-ignore lint/suspicious/noArrayIndexKey: skeleton
							key={i}
							className="h-28 animate-pulse rounded-xl bg-zinc-900"
						/>
					))}
				</div>
			)}

			{/* Primary stats */}
			{stats && (
				<>
					<div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
						<StatCard
							label="Total Users"
							value={stats.totalUsers.toLocaleString()}
							subtitle={`+${stats.newUsersLast7Days} this week`}
							icon={Users}
						/>
						<StatCard
							label="Active Jobs"
							value={stats.activeJobsNow}
							subtitle="Right now"
							icon={Video}
							accent={stats.activeJobsNow > 0 ? "green" : "default"}
							pulse
						/>
						<StatCard
							label="Jobs (24h)"
							value={stats.jobsLast24h.toLocaleString()}
							icon={BarChart3}
						/>
						<StatCard
							label="Failed (24h)"
							value={stats.failedJobsLast24h}
							icon={AlertCircle}
							accent={stats.failedJobsLast24h > 0 ? "red" : "default"}
						/>
					</div>

					{/* Provider Key Health */}
					<div className="rounded-xl border border-zinc-800 bg-zinc-900">
						<div className="flex items-center gap-3 border-b border-zinc-800 px-5 py-4">
							<Key className="size-4 text-zinc-400" />
							<h2 className="text-sm font-semibold text-zinc-100">
								API Provider Health
							</h2>
						</div>

						{stats.providerHealth.length === 0 ? (
							<div className="px-5 py-8 text-center text-sm text-zinc-500">
								No provider keys configured.
							</div>
						) : (
							<div className="divide-y divide-zinc-800/60 px-5">
								{stats.providerHealth.map((p) => (
									<ProviderHealthRow
										key={p.provider}
										provider={p.provider}
										total={p.total}
										active={p.active}
										cooling={p.cooling}
										disabled={p.disabled}
									/>
								))}
							</div>
						)}
					</div>

					{/* Recent Errors */}
					<div className="rounded-xl border border-zinc-800 bg-zinc-900">
						<div className="flex items-center gap-3 border-b border-zinc-800 px-5 py-4">
							<AlertCircle className="size-4 text-zinc-400" />
							<h2 className="text-sm font-semibold text-zinc-100">
								Recent Failed Jobs
							</h2>
							<span className="ml-auto rounded-full border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
								Last 10
							</span>
						</div>

						{stats.recentErrors.length === 0 ? (
							<div className="flex flex-col items-center py-12 text-center">
								<CheckCircle2 className="size-8 text-emerald-500" />
								<p className="mt-3 text-sm font-medium text-zinc-300">
									No recent errors
								</p>
								<p className="mt-1 text-xs text-zinc-500">
									All recent jobs completed successfully.
								</p>
							</div>
						) : (
							<div className="overflow-x-auto">
								<table className="w-full text-sm">
									<thead>
										<tr className="border-b border-zinc-800/60">
											{["User Email", "Error Message", "Date"].map((col) => (
												<th
													key={col}
													className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500"
												>
													{col}
												</th>
											))}
										</tr>
									</thead>
									<tbody className="divide-y divide-zinc-800/40">
										{stats.recentErrors.map((err) => (
											<tr
												key={err.id}
												className="transition-colors hover:bg-zinc-800/30"
											>
												<td className="px-5 py-3 text-xs text-zinc-400">
													{err.userEmail ?? (
														<span className="text-zinc-600">(deleted)</span>
													)}
												</td>
												<td className="max-w-[320px] px-5 py-3">
													<p
														className="truncate text-xs text-red-400"
														title={err.errorMessage ?? ""}
													>
														{err.errorMessage ?? (
															<span className="text-zinc-600">No message</span>
														)}
													</p>
												</td>
												<td className="px-5 py-3 text-xs text-zinc-500">
													{new Date(err.createdAt).toLocaleDateString()}{" "}
													{new Date(err.createdAt).toLocaleTimeString([], {
														hour: "2-digit",
														minute: "2-digit",
													})}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}
					</div>
				</>
			)}
		</div>
	)
}
