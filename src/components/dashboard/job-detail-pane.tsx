import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Download, Unplug } from "lucide-react";
import { toast } from "sonner";

import { labelForPipelineStage } from "@/features/video/pipeline/pipeline-kind";
import type { VideoJobListRow } from "@/features/video/video-job-list.types";
import {
	MAX_MANUAL_RETRIES,
	publishVideoJobApprovalFn,
	retryPublishFn,
	retryVideoJobFn,
} from "@/features/video/video-jobs.functions";
import {
	formatOutputRetentionDeadlineUtc,
	humanizeRetentionHours,
	PAID_TIER_RETENTION_HOURS,
} from "@/lib/format-output-retention";
import {
	platformDisplayName,
	platformVideoUrl,
} from "@/lib/platform-publishing";
import { Button } from "../ui/button";

export function JobDetailPane({
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

	const retryPublishMutation = useMutation({
		mutationFn: async () => {
			const r = await retryPublishFn({
				data: {
					jobId: job.id,
					platform: job.channelPlatform as "youtube" | "tiktok" | "instagram",
				},
			});
			return r;
		},
		onSuccess: (r) => {
			if (r.ok) {
				toast.success("Publish queued — check back in a moment.");
				onRefetch();
				return;
			}
			if (r.code === "unauthorized") {
				toast.error("Sign in required.");
			} else {
				toast.error("Retry failed. Try again.");
			}
		},
		onError: () => {
			toast.error("Something went wrong.");
		},
	});

	const pendingApproval = job.publishApprovalStatus === "pending";
	const isFreeTrial =
		job.costCredits === 0 &&
		job.status === "completed" &&
		Boolean(job.outputStorageExpiresAt);
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
					isYoutubeTokenError(job.publishLastError) ? (
						<div className="rounded-lg border border-amber-500/35 bg-amber-500/8 px-3 py-2.5">
							<div className="flex items-center gap-2">
								<Unplug className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
								<p className="text-sm font-medium text-foreground">
									YouTube access expired
								</p>
							</div>
							<p className="mt-1 text-xs text-muted-foreground">
								Google revoked Klipse's access. Reconnect then retry publishing.
							</p>
							<div className="mt-2 flex flex-wrap items-center gap-3">
								<Link
									to="/dashboard/publishing/$destinationId"
									params={{ destinationId: job.channelId }}
									className="text-xs font-semibold text-primary hover:underline"
								>
									Reconnect YouTube →
								</Link>
								<Button
									type="button"
									size="sm"
									variant="outline"
									className="h-7 text-xs"
									disabled={retryPublishMutation.isPending}
									onClick={() => retryPublishMutation.mutate()}
								>
									{retryPublishMutation.isPending
										? "Retrying…"
										: "Retry publish"}
								</Button>
							</div>
						</div>
					) : (
						<p className="text-xs text-destructive">
							Publish failed: {job.publishLastError}
						</p>
					)
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
				{isFreeTrial && job.outputStorageExpiresAt ? (
					<div className="rounded-lg border border-amber-500/35 bg-amber-500/8 px-3 py-2.5">
						<p className="text-sm font-medium text-foreground">
							Free trial video
						</p>
						<p className="mt-1 text-xs leading-relaxed text-muted-foreground">
							This video will be permanently deleted on{" "}
							<span className="font-medium text-foreground">
								{formatOutputRetentionDeadlineUtc(job.outputStorageExpiresAt)}
							</span>
							. Download it now or{" "}
							<Link
								to="/dashboard/billing"
								className="font-semibold text-primary hover:underline"
							>
								upgrade your plan
							</Link>{" "}
							to keep generating.
						</p>
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
								<p className="max-w-48 text-right text-xs text-destructive">
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

/**
 * True when `publishLastError` indicates a revoked / expired OAuth token —
 * used to show a friendly "Reconnect YouTube" prompt instead of a raw error.
 */
function isYoutubeTokenError(error: string): boolean {
	const e = error.toLowerCase();
	return (
		e === "missing_oauth_refresh_token" ||
		e.includes("invalid_grant") ||
		e.includes("token has been") ||
		e.includes("revoked")
	);
}
