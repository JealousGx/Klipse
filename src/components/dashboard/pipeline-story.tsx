import { RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";

import type { ChannelSnapshot } from "@/features/channels/channel-snapshot.types";
import { labelForPipelineKind } from "@/features/video/pipeline/pipeline-kind";
import type { VideoJobListRow } from "@/features/video/video-job-list.types";

import { cn } from "@/lib/utils";

import { ActiveDestinationSnapshotCard } from "./active-destination-snapshot-card";
import { JobDetailPane } from "./job-detail-pane";
import { LatestJobSnapshotCard } from "./latest-job-snapshort-card";
import { statusLabel, tagFromNiche } from "./utils";

export function shortJobId(id: string): string {
	const t = id.trim();
	if (t.length <= 10) return t;
	return `${t.slice(0, 6)}…${t.slice(-4)}`;
}

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
											{`${j.artifacts?.title ? `${j.artifacts.title}` : `${shortJobId(j.id)} · ${j.channelName}`}`}
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
				<div className="aspect-video animate-pulse bg-muted/60 lg:aspect-auto lg:min-h-50" />
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
