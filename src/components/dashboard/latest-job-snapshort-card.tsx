import { Link } from "@tanstack/react-router";
import { Download } from "lucide-react";

import {
	labelForPipelineKind,
	labelForPipelineStage,
} from "@/features/video/pipeline/pipeline-kind";
import type { VideoJobListRow } from "@/features/video/video-job-list.types";

import { Button } from "../ui/button";
import { JobStatusPill } from "./job-status-pill";
import { statusLabel, tagFromNiche } from "./utils";

export function shortJobId(id: string): string {
	const t = id.trim();
	if (t.length <= 10) return t;
	return `${t.slice(0, 6)}…${t.slice(-4)}`;
}

export function LatestJobSnapshotCard({
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
