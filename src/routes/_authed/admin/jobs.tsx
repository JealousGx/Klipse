import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	AlertCircle,
	ChevronDown,
	ChevronUp,
	MoreHorizontal,
	RefreshCw,
	StopCircle,
	Video,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	type AdminJobRow,
	cancelAdminJobFn,
	listAdminJobsFn,
} from "@/features/admin/admin-jobs.functions";

export const Route = createFileRoute("/_authed/admin/jobs")({
	component: AdminJobsPage,
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 50;

type StatusFilter =
	| "all"
	| "queued"
	| "dispatched"
	| "processing"
	| "completed"
	| "failed";

const TABS: { label: string; value: StatusFilter }[] = [
	{ label: "All", value: "all" },
	{ label: "Queued", value: "queued" },
	{ label: "Dispatched", value: "dispatched" },
	{ label: "Processing", value: "processing" },
	{ label: "Completed", value: "completed" },
	{ label: "Failed", value: "failed" },
];

const ACTIVE_STATUSES = new Set(["queued", "dispatched", "processing"]);

// ---------------------------------------------------------------------------
// Status Badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
	if (status === "queued") {
		return (
			<span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/15 px-2.5 py-0.5 text-xs font-medium text-blue-400">
				Queued
			</span>
		)
	}
	if (status === "dispatched") {
		return (
			<span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/15 px-2.5 py-0.5 text-xs font-medium text-sky-400">
				Dispatched
			</span>
		)
	}
	if (status === "processing") {
		return (
			<span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-400">
				<span className="size-1.5 animate-pulse rounded-full bg-amber-400" />
				Processing
			</span>
		)
	}
	if (status === "completed") {
		return (
			<span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
				Completed
			</span>
		)
	}
	if (status === "failed") {
		return (
			<span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/15 px-2.5 py-0.5 text-xs font-medium text-red-400">
				<AlertCircle className="size-3" />
				Failed
			</span>
		)
	}
	return (
		<span className="inline-flex items-center rounded-full border border-zinc-700 bg-zinc-800 px-2.5 py-0.5 text-xs text-zinc-400">
			{status}
		</span>
	)
}

// ---------------------------------------------------------------------------
// Stat Card
// ---------------------------------------------------------------------------

function StatCard({
	label,
	value,
	accent,
}: {
	label: string;
	value: number;
	accent?: "amber" | "green" | "red" | "blue";
}) {
	const valueClass =
		accent === "amber"
			? "text-amber-400"
			: accent === "green"
				? "text-emerald-400"
				: accent === "red"
					? "text-red-400"
					: accent === "blue"
						? "text-blue-400"
						: "text-zinc-100"

	return (
		<div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
			<p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
				{label}
			</p>
			<p className={`mt-1 text-3xl font-bold ${valueClass}`}>{value}</p>
		</div>
	)
}

// ---------------------------------------------------------------------------
// Row expand — error details
// ---------------------------------------------------------------------------

function JobRow({
	job,
	onCancel,
	isCancelling,
}: {
	job: AdminJobRow;
	onCancel: (id: string) => void;
	isCancelling: boolean;
}) {
	const [expanded, setExpanded] = useState(false);
	const isActive = ACTIVE_STATUSES.has(job.status);

	return (
		<>
			<tr className="transition-colors hover:bg-zinc-800/40">
				<td className="px-4 py-3.5">
					<p className="text-xs font-medium text-zinc-300">{job.userEmail}</p>
				</td>
				<td className="max-w-30 px-4 py-3.5">
					<p className="truncate text-sm text-zinc-400" title={job.channelName ?? ""}>
						{job.channelName}
					</p>
				</td>
				<td className="px-4 py-3.5">
					<span className="rounded-md border border-zinc-700/50 bg-zinc-800/50 px-1.5 py-0.5 text-xs font-medium text-zinc-400">
						{job.pipelineKind}
					</span>
				</td>
				<td className="px-4 py-3.5">
					<StatusBadge status={job.status} />
				</td>
				<td className="px-4 py-3.5 tabular-nums text-sm text-zinc-400">
					{isActive ? (
						`${job.progress}%`
					) : (
						<span className="text-zinc-600">—</span>
					)}
				</td>
				<td className="w-52 px-4 py-3.5">
					{job.errorMessage ? (
						<button
							type="button"
							onClick={() => setExpanded((v) => !v)}
							className="flex w-full items-start gap-1.5 text-left text-xs text-red-400 hover:text-red-300"
						>
							<AlertCircle className="mt-0.5 size-3 shrink-0" />
							<span className="line-clamp-2 flex-1 break-all">{job.errorMessage}</span>
							{expanded ? (
								<ChevronUp className="mt-0.5 size-3 shrink-0" />
							) : (
								<ChevronDown className="mt-0.5 size-3 shrink-0" />
							)}
						</button>
					) : (
						<span className="text-zinc-600">—</span>
					)}
				</td>
				<td className="px-4 py-3.5 text-xs text-zinc-500">
					{new Date(job.createdAt).toLocaleDateString()}{" "}
					<span className="text-zinc-600">
						{new Date(job.createdAt).toLocaleTimeString([], {
							hour: "2-digit",
							minute: "2-digit",
						})}
					</span>
				</td>
				<td className="px-4 py-3.5">
					{isActive && (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<button
									type="button"
									disabled={isCancelling}
									className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300 disabled:opacity-40"
								>
									<MoreHorizontal className="size-4" />
								</button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="w-36">
								<DropdownMenuItem
									variant="destructive"
									onClick={() => {
										if (window.confirm(`Cancel job ${job.id}?`)) {
											onCancel(job.id);
										}
									}}
									disabled={isCancelling}
								>
									<StopCircle className="size-3.5" />
									Cancel Job
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					)}
				</td>
			</tr>
			{expanded && job.errorMessage && (
				<tr className="bg-red-950/20">
					<td colSpan={8} className="px-4 pb-4 pt-0">
						<pre className="whitespace-pre-wrap break-all rounded-lg bg-zinc-950 p-3 text-xs leading-relaxed text-red-300">
							{job.errorMessage}
						</pre>
					</td>
				</tr>
			)}
		</>
	);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function AdminJobsPage() {
	const queryClient = useQueryClient();
	const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
	const [page, setPage] = useState(0);
	const [cancellingId, setCancellingId] = useState<string | null>(null);

	const { data, isLoading, isError, isFetching, refetch } = useQuery({
		queryKey: ["admin-jobs", statusFilter, page],
		queryFn: () =>
			listAdminJobsFn({
				data: {
					status: statusFilter,
					limit: PAGE_SIZE,
					offset: page * PAGE_SIZE,
				},
			}),
		staleTime: 5_000,
		refetchInterval: (query) => {
			const jobs = query.state.data?.ok ? query.state.data.jobs : [];
			const hasActive = jobs.some((j) => ACTIVE_STATUSES.has(j.status));
			return hasActive ? 10_000 : false;
		},
	});

	const jobs: AdminJobRow[] = data?.ok ? data.jobs : [];
	const total = data?.ok ? data.total : 0;

	// Derived counts from current page
	const queuedCount = jobs.filter((j) => j.status === "queued").length;
	const processingCount = jobs.filter((j) => j.status === "processing").length;
	const completedCount = jobs.filter((j) => j.status === "completed").length;
	const failedCount = jobs.filter((j) => j.status === "failed").length;

	const cancelMutation = useMutation({
		mutationFn: (jobId: string) => cancelAdminJobFn({ data: { jobId } }),
		onSuccess: (result, _jobId) => {
			setCancellingId(null);
			if (result.ok) {
				toast.success("Job cancelled.");
				queryClient.invalidateQueries({ queryKey: ["admin-jobs"] });
			} else if (result.code === "already_terminal") {
				toast.error("Job is already in a terminal state.");
			} else {
				toast.error("Failed to cancel job.");
			}
		},
		onError: () => {
			setCancellingId(null);
			toast.error("Failed to cancel job.");
		},
	})

	function handleCancel(jobId: string) {
		setCancellingId(jobId);
		cancelMutation.mutate(jobId);
	}

	const start = page * PAGE_SIZE + 1;
	const end = Math.min(start + jobs.length - 1, total);
	const hasPrev = page > 0;
	const hasNext = end < total;

	return (
		<div className="space-y-8">
			{/* Header */}
			<div className="flex items-start justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold text-zinc-100">Jobs</h1>
					<p className="mt-1 text-sm text-zinc-400">
						Monitor video generation jobs across all users.
					</p>
				</div>
				<Button
					variant="outline"
					size="sm"
					onClick={() => refetch()}
					disabled={isFetching}
					className="shrink-0"
				>
					<RefreshCw
						className={`mr-1.5 size-4 ${isFetching ? "animate-spin" : ""}`}
					/>
					Refresh
				</Button>
			</div>

			{/* Status filter tabs */}
			<div className="flex gap-1 overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900 p-1">
				{TABS.map((tab) => (
					<button
						type="button"
						key={tab.value}
						onClick={() => {
							setStatusFilter(tab.value);
							setPage(0)
						}}
						className={[
							"shrink-0 rounded-lg px-3.5 py-2 text-sm font-medium transition-all",
							statusFilter === tab.value
								? "bg-zinc-800 text-zinc-100 shadow-sm"
								: "text-zinc-500 hover:text-zinc-300",
						].join(" ")}
					>
						{tab.label}
					</button>
				))}
			</div>

			{/* Stats */}
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
				<StatCard label="Queued" value={queuedCount} accent="blue" />
				<StatCard label="Processing" value={processingCount} accent="amber" />
				<StatCard label="Completed" value={completedCount} accent="green" />
				<StatCard label="Failed" value={failedCount} accent="red" />
			</div>

			{/* Table */}
			{isLoading ? (
				<div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 p-4">
					<div className="space-y-2">
						{Array.from({ length: 10 }).map((_, i) => (
							<div
								// biome-ignore lint/suspicious/noArrayIndexKey: skeleton
								key={i}
								className="h-12 animate-pulse rounded-lg bg-zinc-800/60"
							/>
						))}
					</div>
				</div>
			) : isError || (data && !data.ok) ? (
				<div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
					<AlertCircle className="size-4 shrink-0" />
					Failed to load jobs.
				</div>
			) : (
				<>
					<div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
						<div className="overflow-x-auto">
							<table className="w-full text-sm">
								<thead>
									<tr className="border-b border-zinc-800">
										{[
											"User",
											"Channel",
											"Type",
											"Status",
											"Progress",
											"Error",
											"Created",
											"Actions",
										].map((col) => (
											<th
												key={col}
												className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500"
											>
												{col}
											</th>
										))}
									</tr>
								</thead>
								<tbody className="divide-y divide-zinc-800/60">
									{jobs.length === 0 ? (
										<tr>
											<td
												colSpan={8}
												className="px-4 py-16 text-center text-sm text-zinc-500"
											>
												<Video className="mx-auto mb-2 size-8 text-zinc-700" />
												No jobs found.
											</td>
										</tr>
									) : (
										jobs.map((job) => (
											<JobRow
												key={job.id}
												job={job}
												onCancel={handleCancel}
												isCancelling={cancellingId === job.id}
											/>
										))
									)}
								</tbody>
							</table>
						</div>
					</div>

					{/* Pagination */}
					{total > PAGE_SIZE && (
						<div className="flex items-center justify-between text-sm text-zinc-400">
							<span>
								Showing {start}–{end} of {total}
							</span>
							<div className="flex gap-2">
								<Button
									variant="outline"
									size="sm"
									disabled={!hasPrev}
									onClick={() => setPage((p) => p - 1)}
								>
									Previous
								</Button>
								<Button
									variant="outline"
									size="sm"
									disabled={!hasNext}
									onClick={() => setPage((p) => p + 1)}
								>
									Next
								</Button>
							</div>
						</div>
					)}
				</>
			)}
		</div>
	)
}
