import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Download, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import type { ChannelSnapshot } from "@/features/channels/channel-snapshot.types";
import {
	labelForPipelineKind,
	labelForPipelineStage,
} from "@/features/video/pipeline/pipeline-kind";
import type { VideoJobListRow } from "@/features/video/video-job-list.types";
import {
	MAX_MANUAL_RETRIES,
	publishVideoJobApprovalFn,
	retryVideoJobFn,
} from "@/features/video/video-jobs.functions";

import {
	formatOutputRetentionDeadlineUtc,
	humanizeRetentionHours,
	PAID_TIER_RETENTION_HOURS,
} from "@/lib/format-output-retention";
import {
	platformChannelUrl,
	platformDisplayName as platformDisplayNameUtil,
	platformVideoUrl,
} from "@/lib/platform-publishing";
import { cn } from "@/lib/utils";

export function shortJobId(id: string): string {
	const t = id.trim();
	if (t.length <= 10) return t;
	return `${t.slice(0, 6)}…${t.slice(-4)}`;
}

const statusLabel: Record<VideoJobListRow["status"], string> = {
	queued: "Queued",
	dispatched: "Handoff",
	processing: "Processing",
	completed: "Done",
	failed: "Failed",
};

function JobStatusPill({ status }: { status: VideoJobListRow["status"] }) {
	const base =
		"rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide";
	const styles: Record<VideoJobListRow["status"], string> = {
		queued: "border-border text-muted-foreground",
		dispatched:
			"border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200",
		processing: "border-primary/40 bg-primary/10 text-primary",
		completed: "border-border bg-muted text-foreground",
		failed: "border-destructive/40 bg-destructive/10 text-destructive",
	};
	return (
		<span className={cn(base, styles[status])}>{statusLabel[status]}</span>
	);
}

function platformDisplayName(
	p: VideoJobListRow["channelPlatform"] | ChannelSnapshot["platform"],
): string {
	return platformDisplayNameUtil(p);
}

function tagFromNiche(niche: string): string[] {
	const words = niche
		.split(/[\s,]+/)
		.map((w) => w.trim())
		.filter(Boolean)
		.slice(0, 4);
	return words.length ? words : ["destination"];
}

type JobQueueStoryCardProps = {
	jobs: VideoJobListRow[];
	isLoading: boolean;
	onRefetch: () => void;
	isRefetching: boolean;
};

/** Full-width job queue + detail (Jobs page). */
export function JobQueueStoryCard({
	jobs,
	isLoading,
	onRefetch,
	isRefetching,
}: JobQueueStoryCardProps) {
	const [selectedId, setSelectedId] = useState<string | null>(null);

	const selected = useMemo(() => {
		if (jobs.length === 0) return null;
		if (selectedId) {
			const found = jobs.find((j) => j.id === selectedId);
			if (found) return found;
		}
		return jobs[0];
	}, [jobs, selectedId]);

	if (isLoading) {
		return <PipelineStoryChromeSkeleton />;
	}

	if (jobs.length === 0) {
		return null;
	}

	const title = `${selected?.channelName ?? "Job"} · ${shortJobId(selected?.id ?? "")}`;
	const tags = selected
		? [
				...(selected.artifacts?.tags?.length
					? selected.artifacts.tags.slice(0, 4)
					: tagFromNiche(selected.channelNiche)),
				labelForPipelineKind(selected.pipelineKind),
				`${selected.costCredits} credits`,
			]
		: [];

	return (
		<section
			className="overflow-hidden rounded-xl border border-border bg-card text-left shadow-sm"
			aria-label="Video jobs"
		>
			<div className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-3">
				<div className="flex flex-wrap items-center gap-2">
					<span className="font-heading text-sm font-semibold text-foreground">
						Video queue
					</span>
					<span className="rounded border border-border bg-background px-2 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
						{jobs.length} {jobs.length === 1 ? "job" : "jobs"}
					</span>
				</div>
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="h-8 gap-1.5 text-xs font-semibold"
					onClick={() => onRefetch()}
					disabled={isRefetching}
				>
					<RefreshCw
						className={cn("size-3.5", isRefetching && "animate-spin")}
						aria-hidden
					/>
					Sync
				</Button>
			</div>

			<div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
				<div className="border-b border-border lg:border-b-0 lg:border-r">
					<div className="border-b border-border px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
						Status
					</div>
					<ul className="max-h-[min(52vh,28rem)] divide-y divide-border overflow-y-auto">
						{jobs.map((j) => {
							const active = selected?.id === j.id;
							return (
								<li key={j.id}>
									<button
										type="button"
										onClick={() => setSelectedId(j.id)}
										className={cn(
											"grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors",
											active ? "bg-primary/5" : "hover:bg-muted/40",
										)}
									>
										<JobStatusPill status={j.status} />
										<span className="min-w-0 truncate font-medium text-foreground">
											{shortJobId(j.id)} · {j.channelName}
										</span>
									</button>
								</li>
							);
						})}
					</ul>
				</div>

				{selected ? (
					<JobDetailPane
						job={selected}
						title={title}
						tags={tags}
						onRefetch={() => void onRefetch()}
					/>
				) : null}
			</div>
		</section>
	);
}

function JobDetailPane({
	job,
	title,
	tags,
	onRefetch,
}: {
	job: VideoJobListRow;
	title: string;
	tags: string[];
	onRefetch: () => void;
}) {
	const approvalMutation = useMutation({
		mutationFn: async (decision: "approved" | "rejected") => {
			const r = await publishVideoJobApprovalFn({
				data: { jobId: job.id, decision },
			});
			return r;
		},
		onSuccess: (r) => {
			if (r.ok) {
				toast.success("Publish decision saved.");
				onRefetch();
				return;
			}
			if (r.code === "unauthorized") {
				toast.error("Sign in required.");
			} else if (r.code === "not_found") {
				toast.error("Job not found.");
			} else {
				toast.error("This job is not awaiting approval.");
			}
		},
		onError: () => {
			toast.error("Something went wrong.");
		},
	});

	const retryMutation = useMutation({
		mutationFn: async () => {
			const r = await retryVideoJobFn({ data: { jobId: job.id } });
			return r;
		},
		onSuccess: (r) => {
			if (r.ok) {
				toast.success("Job queued for retry.");
				onRefetch();
				return;
			}
			if (r.code === "max_retries") {
				toast.error("Maximum retries reached for this job.");
			} else if (r.code === "not_failed") {
				toast.error("This job is not in a failed state.");
			} else if (r.code === "not_found") {
				toast.error("Job not found.");
			} else {
				toast.error("Sign in required.");
			}
		},
		onError: () => {
			toast.error("Something went wrong. Please try again.");
		},
	});

	const pendingApproval = job.publishApprovalStatus === "pending";
	const retentionNote = job.outputStorageExpiresAt
		? `This video is scheduled for removal after ${formatOutputRetentionDeadlineUtc(job.outputStorageExpiresAt)}. Approve or reject before then so you don’t lose access.`
		: `Videos are kept for ${humanizeRetentionHours(PAID_TIER_RETENTION_HOURS)} on paid plans (then purged). Approve or reject before your window ends.`;

	return (
		<div className="flex flex-col">
			<div className="relative aspect-video w-full border-b border-border bg-muted">
				{job.outputUrl ? (
					// biome-ignore lint/a11y/useMediaCaption: pipeline output may not include caption tracks yet
					<video
						className="size-full object-contain"
						controls
						src={job.outputUrl}
						preload="metadata"
					/>
				) : (
					<div className="absolute inset-0 flex items-center justify-center bg-foreground/5">
						<div className="flex size-14 items-center justify-center rounded-full border-2 border-foreground/20 bg-background shadow-sm">
							<div
								className="ml-0.5 h-0 w-0 border-y-10 border-l-14 border-y-transparent border-l-foreground"
								aria-hidden
							/>
						</div>
					</div>
				)}
				<div className="absolute bottom-2 left-2 rounded border border-border/80 bg-background px-2 py-1 font-mono text-[10px] font-medium text-foreground">
					{job.progress}% · {labelForPipelineStage(job.currentStage)}
				</div>
			</div>
			<div className="space-y-3 p-4">
				{job.outputUrl && job.status === "completed" ? (
					<div className="flex flex-wrap gap-2">
						<a
							href={job.outputUrl}
							target="_blank"
							download
							className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-semibold text-foreground shadow-sm hover:bg-muted/60"
						>
							<Download className="size-3.5 shrink-0" aria-hidden />
							Download MP4
						</a>
						{job.publishedVideoId
							? (() => {
									const url = platformVideoUrl(
										job.channelPlatform,
										job.publishedVideoId,
									);
									return url ? (
										<a
											href={url}
											target="_blank"
											rel="noreferrer"
											className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-semibold text-foreground shadow-sm hover:bg-muted/60"
										>
											Open on {platformDisplayName(job.channelPlatform)}
											<ArrowUpRight
												className="size-3.5 shrink-0 opacity-90"
												aria-hidden
											/>
										</a>
									) : null;
								})()
							: null}
					</div>
				) : null}
				{job.publishLastError &&
				job.status === "completed" &&
				!job.publishedVideoId ? (
					<p className="text-xs text-destructive">
						Publish failed: {job.publishLastError}
					</p>
				) : null}
				<div>
					<p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
						Video Title
					</p>
					<p className="mt-0.5 font-medium text-foreground">
						{job.artifacts?.title ?? title}
					</p>
				</div>
				{job.artifacts?.description ? (
					<div>
						<p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
							Description
						</p>
						<p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
							{job.artifacts.description}
						</p>
					</div>
				) : null}
				<div>
					<p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
						Tags
					</p>
					<div className="mt-1.5 flex flex-wrap gap-1.5">
						{tags.slice(0, 6).map((tag) => (
							<span
								key={tag}
								className="rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs font-medium text-foreground"
							>
								{tag}
							</span>
						))}
					</div>
				</div>
				{pendingApproval ? (
					<div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm text-foreground">
						<p className="font-medium">Your call before anything goes live</p>
						<p className="mt-1 text-xs text-muted-foreground">
							This destination is set to ask you first. Approve or reject below.
						</p>
						<p className="mt-2 rounded-md border border-amber-600/25 bg-amber-500/5 px-2.5 py-2 text-xs leading-relaxed text-amber-950 dark:text-amber-100/95">
							{retentionNote}
						</p>
						<div className="mt-3 flex flex-wrap gap-2">
							<Button
								type="button"
								size="sm"
								className="h-8 text-xs font-semibold"
								disabled={approvalMutation.isPending}
								onClick={() => approvalMutation.mutate("approved")}
							>
								Approve publish
							</Button>
							<Button
								type="button"
								size="sm"
								variant="outline"
								className="h-8 text-xs font-semibold"
								disabled={approvalMutation.isPending}
								onClick={() => approvalMutation.mutate("rejected")}
							>
								Reject
							</Button>
						</div>
					</div>
				) : null}
				<div className="flex flex-wrap items-start justify-between gap-3 border-t border-border pt-3">
					<div>
						<p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
							Destination
						</p>
						<Link
							to="/dashboard/publishing/$destinationId"
							params={{ destinationId: job.channelId }}
							className="mt-0.5 block text-sm font-semibold text-primary hover:underline"
						>
							{job.channelName}
						</Link>
						<p className="mt-1 text-xs text-muted-foreground">
							{platformDisplayName(job.channelPlatform)} · {job.costCredits}{" "}
							credits
						</p>
					</div>
					{job.status === "failed" ? (
						<div className="flex flex-col items-end gap-2">
							{job.errorMessage ? (
								<p className="max-w-[12rem] text-right text-xs text-destructive">
									{job.errorMessage}
								</p>
							) : null}
							{job.retryCount < MAX_MANUAL_RETRIES ? (
								<Button
									type="button"
									variant="outline"
									size="sm"
									className="h-7 text-xs"
									disabled={retryMutation.isPending}
									onClick={() => retryMutation.mutate()}
								>
									{retryMutation.isPending ? "Retrying…" : "Retry"}
								</Button>
							) : (
								<p className="text-xs text-muted-foreground">
									Max retries reached.
								</p>
							)}
						</div>
					) : null}
				</div>
			</div>
		</div>
	);
}

function PipelineStoryChromeSkeleton() {
	return (
		<section
			className="overflow-hidden rounded-xl border border-border bg-card text-left shadow-sm"
			aria-busy
			aria-label="Loading jobs"
		>
			<div className="h-12 animate-pulse border-b border-border bg-muted/40" />
			<div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
				<div className="space-y-2 border-b border-border p-3 lg:border-b-0 lg:border-r">
					{[1, 2, 3, 4].map((i) => (
						<div
							key={i}
							className="h-10 animate-pulse rounded-md bg-muted/60"
						/>
					))}
				</div>
				<div className="aspect-video animate-pulse bg-muted/60 lg:aspect-auto lg:min-h-[200px]" />
			</div>
		</section>
	);
}

type OverviewHeroProps = {
	latestJob: VideoJobListRow | null;
	activeChannel: ChannelSnapshot | null;
	jobsLoading: boolean;
	channelsLoading: boolean;
};

/** Hero strip: latest job + primary destination (Overview). */
export function OverviewPipelineHero({
	latestJob,
	activeChannel,
	jobsLoading,
	channelsLoading,
}: OverviewHeroProps) {
	return (
		<div className="grid gap-4 lg:grid-cols-2">
			<LatestJobSnapshotCard job={latestJob} isLoading={jobsLoading} />
			<ActiveDestinationSnapshotCard
				channel={activeChannel}
				isLoading={channelsLoading}
			/>
		</div>
	);
}

function LatestJobSnapshotCard({
	job,
	isLoading,
}: {
	job: VideoJobListRow | null;
	isLoading: boolean;
}) {
	if (isLoading) {
		return (
			<div
				className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
				aria-busy
			>
				<div className="h-11 animate-pulse border-b border-border bg-muted/40" />
				<div className="aspect-video animate-pulse bg-muted/50" />
				<div className="space-y-2 p-4">
					<div className="h-4 w-2/3 animate-pulse rounded bg-muted/60" />
					<div className="h-3 w-full animate-pulse rounded bg-muted/40" />
				</div>
			</div>
		);
	}

	if (!job) {
		return (
			<section className="overflow-hidden rounded-xl border border-dashed border-border/80 bg-muted/10 p-6 text-center shadow-sm">
				<p className="font-heading text-sm font-semibold text-foreground">
					Latest job
				</p>
				<p className="mt-2 text-sm text-muted-foreground">
					No runs yet. Start a generate to see your pipeline here.
				</p>
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="mt-4"
					asChild
				>
					<Link to="/dashboard/generate">Go to Generate</Link>
				</Button>
			</section>
		);
	}

	const title = `${job.channelName} · ${shortJobId(job.id)}`;
	const tags = [
		...tagFromNiche(job.channelNiche).slice(0, 2),
		labelForPipelineKind(job.pipelineKind),
		statusLabel[job.status],
		`${job.costCredits} credits`,
	];

	return (
		<section
			className="overflow-hidden rounded-xl border border-border bg-card text-left shadow-sm"
			aria-label="Latest job"
		>
			<div className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-3">
				<div className="flex flex-wrap items-center gap-2">
					<span className="font-heading text-sm font-semibold text-foreground">
						Latest job
					</span>
					<JobStatusPill status={job.status} />
				</div>
				<Button
					variant="outline"
					size="sm"
					className="h-8 text-xs font-semibold"
					asChild
				>
					<Link to="/dashboard/jobs">All jobs</Link>
				</Button>
			</div>
			<div className="grid gap-0 sm:grid-cols-[1fr_minmax(0,1.2fr)]">
				<div className="relative aspect-video border-b border-border bg-muted sm:border-b-0 sm:border-r">
					{job.outputUrl ? (
						// biome-ignore lint/a11y/useMediaCaption: pipeline output may not include caption tracks yet
						<video
							className="size-full object-contain"
							controls
							src={job.outputUrl}
							preload="metadata"
						/>
					) : (
						<div className="absolute inset-0 flex items-center justify-center bg-foreground/5">
							<div className="flex size-12 items-center justify-center rounded-full border-2 border-foreground/20 bg-background shadow-sm">
								<div
									className="ml-0.5 h-0 w-0 border-y-8 border-l-12 border-y-transparent border-l-foreground"
									aria-hidden
								/>
							</div>
						</div>
					)}
					<div className="absolute bottom-2 left-2 rounded border border-border/80 bg-background px-2 py-1 font-mono text-[10px] font-medium text-foreground">
						{job.progress}% · {labelForPipelineStage(job.currentStage)}
					</div>
				</div>
				<div className="space-y-3 p-4">
					{job.outputUrl && job.status === "completed" ? (
						<a
							href={job.outputUrl}
							download
							className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-semibold text-foreground shadow-sm hover:bg-muted/60"
						>
							<Download className="size-3.5 shrink-0" aria-hidden />
							Download MP4
						</a>
					) : null}
					<div>
						<p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
							Title
						</p>
						<p className="mt-0.5 font-medium text-foreground">{title}</p>
					</div>
					<div>
						<p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
							Tags
						</p>
						<div className="mt-1.5 flex flex-wrap gap-1.5">
							{tags.map((tag) => (
								<span
									key={tag}
									className="rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs font-medium text-foreground"
								>
									{tag}
								</span>
							))}
						</div>
					</div>
					<Link
						to="/dashboard/publishing/$destinationId"
						params={{ destinationId: job.channelId }}
						className="inline-block text-xs font-semibold text-primary hover:underline"
					>
						Open destination →
					</Link>
				</div>
			</div>
		</section>
	);
}

function ActiveDestinationSnapshotCard({
	channel,
	isLoading,
}: {
	channel: ChannelSnapshot | null;
	isLoading: boolean;
}) {
	if (isLoading) {
		return (
			<div
				className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
				aria-busy
			>
				<div className="h-11 animate-pulse border-b border-border bg-muted/40" />
				<div className="space-y-3 p-4">
					<div className="h-4 w-3/4 animate-pulse rounded bg-muted/60" />
					<div className="h-3 w-full animate-pulse rounded bg-muted/40" />
				</div>
			</div>
		);
	}

	if (!channel) {
		return (
			<section className="overflow-hidden rounded-xl border border-dashed border-border/80 bg-muted/10 p-6 text-center shadow-sm">
				<p className="font-heading text-sm font-semibold text-foreground">
					Publishing destination
				</p>
				<p className="mt-2 text-sm text-muted-foreground">
					Add a destination to attach uploads and channel metadata.
				</p>
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="mt-4"
					asChild
				>
					<Link to="/dashboard/publishing">Publishing</Link>
				</Button>
			</section>
		);
	}

	const linked =
		channel.platform !== "unlinked" && Boolean(channel.externalChannelId);
	const platformName = platformDisplayName(channel.platform);
	const badgeLabel = channel.oauthConnected
		? `${platformName} · connected`
		: linked
			? `${platformName} · linked`
			: "Not connected";

	const tagBits = [
		platformDisplayName(channel.platform),
		...tagFromNiche(channel.niche).slice(0, 3),
	];

	return (
		<section
			className="overflow-hidden rounded-xl border border-border bg-card text-left shadow-sm"
			aria-label="Primary publishing destination"
		>
			<div className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-3">
				<div className="flex flex-wrap items-center gap-2">
					<span className="font-heading text-sm font-semibold text-foreground">
						Active destination
					</span>
					<span
						className={cn(
							"rounded border px-2 py-0.5 font-mono text-[10px] font-medium",
							linked || channel.oauthConnected
								? "border-primary/40 bg-primary/10 text-primary"
								: "border-border bg-background text-muted-foreground",
						)}
					>
						{badgeLabel}
					</span>
				</div>
				<Button
					variant="outline"
					size="sm"
					className="h-8 text-xs font-semibold"
					asChild
				>
					<Link
						to="/dashboard/publishing/$destinationId"
						params={{ destinationId: channel.id }}
					>
						Manage
					</Link>
				</Button>
			</div>
			<div className="space-y-3 p-4">
				<div>
					<p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
						Name
					</p>
					<p className="mt-0.5 font-medium text-foreground">{channel.name}</p>
				</div>
				<div>
					<p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
						Niche
					</p>
					<p className="mt-0.5 line-clamp-3 text-sm text-muted-foreground">
						{channel.niche}
					</p>
				</div>
				<div>
					<p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
						Tags
					</p>
					<div className="mt-1.5 flex flex-wrap gap-1.5">
						{tagBits.map((tag) => (
							<span
								key={tag}
								className="rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs font-medium text-foreground"
							>
								{tag}
							</span>
						))}
					</div>
				</div>
				{channel.externalChannelId ? (
					<div>
						<p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
							Channel id
						</p>
						<p className="mt-0.5 font-mono text-xs text-foreground break-all">
							{channel.externalChannelId}
						</p>
						{channel.externalChannelId &&
						platformChannelUrl(channel.platform, channel.externalChannelId) ? (
							<a
								href={
									platformChannelUrl(
										channel.platform,
										channel.externalChannelId,
									) as string
								}
								target="_blank"
								rel="noopener noreferrer"
								className="mt-2 inline-block text-xs font-semibold text-primary hover:underline"
							>
								Open on {platformDisplayName(channel.platform)} →
							</a>
						) : null}
					</div>
				) : null}
			</div>
		</section>
	);
}
