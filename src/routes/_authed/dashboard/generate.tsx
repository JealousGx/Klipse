import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { Gift, Sparkles, Video } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

import { useDashboardRouteContext } from "@/context/useDashboardRouteContext";
import {
	estimateContentPipelineCredits,
	runContentPipeline,
} from "@/features/video/content-pipeline";
import { authClient } from "@/lib/auth/client";
import {
	FREE_TIER_RETENTION_HOURS,
	humanizeRetentionHours,
} from "@/lib/format-output-retention";
import { channelsQueryOptions } from "@/lib/queries/dashboard-queries";

export const Route = createFileRoute("/_authed/dashboard/generate")({
	staticData: { dashboardTitle: "Generate" },
	beforeLoad: ({ context }) => {
		void context.queryClient.ensureQueryData(channelsQueryOptions);
	},
	component: GeneratePage,
});

const fieldClass =
	"w-full text-sm text-foreground transition disabled:cursor-not-allowed disabled:opacity-50";

function GeneratePage() {
	const queryClient = useQueryClient();
	const router = useRouter();
	const { refetch: refetchSession } = authClient.useSession();
	const { session } = useDashboardRouteContext();
	const user = session.user;

	const [busy, setBusy] = useState(false);
	const [success, setSuccess] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const idempotencyKeyRef = useRef<string | null>(null);
	const [channelId, setChannelId] = useState<string>("");
	const [idea, setIdea] = useState("");

	const creditEstimate = estimateContentPipelineCredits({ idea });
	const channelsQuery = useQuery(channelsQueryOptions);
	const channels = channelsQuery.data ?? [];

	const handleGenerate = async () => {
		const trimmed = idea.trim();
		if (!channelId) {
			setError("Choose a channel first.");
			return;
		}
		if (trimmed.length < 3) {
			setError("Describe what the video is about (at least 3 characters).");
			return;
		}

		if (!idempotencyKeyRef.current) {
			idempotencyKeyRef.current = crypto.randomUUID();
		}
		const idempotencyKey = idempotencyKeyRef.current;

		setBusy(true);
		setSuccess(false);
		setError(null);

		try {
			const r = await runContentPipeline({
				data: { channelId, idempotencyKey, idea: trimmed },
			});

			if (r.ok) {
				idempotencyKeyRef.current = null;
				setIdea("");
				setSuccess(true);
				if (r.creditsConsumed) {
					await refetchSession({ query: { disableCookieCache: true } });
				}
				await router.invalidate();
				void queryClient.invalidateQueries({ queryKey: ["video-jobs"] });
				void channelsQuery.refetch();
			} else if (r.code === "insufficient_credits") {
				setError(
					`You don't have enough credits for this. You need ${r.required} but have ${r.remaining}. Add more under Billing.`,
				);
			} else if (r.code === "channel_not_found") {
				setError("That channel no longer exists. Refresh and try again.");
			} else if (r.code === "free_tier_video_exhausted") {
				setError(
					"Free accounts include one video. Upgrade your plan to generate more.",
				);
			} else if (r.code === "tiktok_config_incomplete") {
				const detail =
					r.reason === "music_usage_not_confirmed"
						? "confirm Music Usage in destination settings"
						: r.reason === "privacy_level_not_set"
							? "set a default visibility in destination settings"
							: "complete the commercial content disclosure in destination settings";
				setError(
					`Your TikTok destination isn't ready to publish yet — ${detail} before generating.`,
				);
			} else {
				setError("You need to be signed in to generate videos.");
			}
		} catch {
			setError("Something went wrong. Please try again.");
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="max-w-2xl space-y-8">
			{/* Header */}
			<div className="space-y-1.5">
				<h2 className="font-heading text-lg font-semibold text-foreground">
					Create a video now
				</h2>
				<p className="text-sm text-muted-foreground">
					Generate a video immediately for any of your channels. Your channels
					also generate videos automatically based on their posting schedule —
					this creates one right now.
				</p>
			</div>

			{/* Free tier notice */}
			{user.plan === "free" ? (
				user.freeVideoConsumed ? (
					<div className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/20 px-5 py-4">
						<Gift className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
						<div className="space-y-1">
							<p className="text-sm font-medium text-foreground">
								Free trial used
							</p>
							<p className="text-sm text-muted-foreground">
								You&rsquo;ve used your one free video.{" "}
								<Link
									to="/dashboard/billing"
									className="font-medium text-primary underline-offset-4 hover:underline"
								>
									Upgrade your plan
								</Link>{" "}
								to generate more.
							</p>
						</div>
					</div>
				) : (
					<div className="flex items-start gap-3 rounded-xl border border-primary/25 bg-primary/5 px-5 py-4">
						<Gift className="mt-0.5 size-4 shrink-0 text-primary" />
						<div className="space-y-1">
							<p className="text-sm font-medium text-foreground">
								Your first video is free
							</p>
							<p className="text-sm text-muted-foreground">
								No credits needed. Generate, watch, and download. Video is kept
								for{" "}
								<span className="font-medium text-foreground">
									{humanizeRetentionHours(FREE_TIER_RETENTION_HOURS)}
								</span>{" "}
								then deleted. Publishing requires a paid plan.
							</p>
						</div>
					</div>
				)
			) : null}

			{/* Form */}
			<div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
				<div className="space-y-5 p-6">
					{/* Channel selector */}
					<div className="space-y-2">
						<label
							htmlFor="gen-channel"
							className="text-sm font-medium text-foreground"
						>
							Channel
						</label>
						{channelsQuery.isPending ? (
							<p className="text-sm text-muted-foreground">Loading channels…</p>
						) : channels.length === 0 ? (
							<p className="text-sm text-muted-foreground">
								No channels yet.{" "}
								<Link
									to="/dashboard/publishing"
									className="font-medium text-primary underline-offset-4 hover:underline"
								>
									Connect a channel
								</Link>{" "}
								first.
							</p>
						) : (
							<Select
								defaultValue={channelId}
								onValueChange={(val) => {
									setChannelId(val);
									setSuccess(false);
									setError(null);
								}}
								disabled={busy}
							>
								<SelectTrigger className={fieldClass}>
									<SelectValue placeholder="Select a channel" />
								</SelectTrigger>
								<SelectContent>
									<SelectGroup>
										<SelectLabel>
											Choose from your connected channels
										</SelectLabel>
										{channels.map((c) => (
											<SelectItem key={c.id} value={c.id}>
												{c.name}
											</SelectItem>
										))}
									</SelectGroup>
								</SelectContent>
							</Select>
						)}
					</div>

					{/* Idea input */}
					<div className="space-y-2">
						<label
							htmlFor="gen-idea"
							className="text-sm font-medium text-foreground"
						>
							What's the video about?
						</label>
						<textarea
							id="gen-idea"
							rows={4}
							placeholder="e.g. 5 money habits that keep most people broke — and how to break them"
							className={`${fieldClass} min-h-24 resize-y`}
							value={idea}
							onChange={(e) => {
								setIdea(e.target.value);
								setSuccess(false);
								setError(null);
							}}
							disabled={busy}
						/>
						<p className="text-xs text-muted-foreground">
							Be specific — the AI uses this as the starting point for the
							script.
						</p>
					</div>
				</div>

				{/* Footer bar */}
				<div className="flex items-center justify-between border-t border-border/70 bg-muted/20 px-6 py-4">
					{user.plan === "free" ? (
						<p className="text-xs text-muted-foreground">
							<span className="font-medium text-foreground">Free trial</span> ·
							view &amp; download only
						</p>
					) : (
						<p className="text-xs text-muted-foreground">
							<span className="font-medium text-foreground">
								~{creditEstimate} credits
							</span>{" "}
							· Balance: {user.creditsRemaining ?? 0}
						</p>
					)}
					<div className="flex items-center gap-3">
						<Button type="button" variant="ghost" size="sm" asChild>
							<Link to="/dashboard/jobs">View jobs</Link>
						</Button>
						<Button
							type="button"
							disabled={
								busy ||
								!channelId ||
								channels.length === 0 ||
								idea.trim().length < 3
							}
							onClick={() => void handleGenerate()}
							className="gap-2"
						>
							<Sparkles className="size-3.5" />
							{busy ? "Generating…" : "Generate video"}
						</Button>
					</div>
				</div>
			</div>

			{/* Success state */}
			{success ? (
				<div className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/20 px-5 py-4">
					<Video className="mt-0.5 size-4 shrink-0 text-primary" />
					<div className="space-y-1">
						<p className="text-sm font-medium text-foreground">
							Your video is being created
						</p>
						<p className="text-sm text-muted-foreground">
							This usually takes a few minutes.{" "}
							<Link
								to="/dashboard/jobs"
								className="font-medium text-primary underline-offset-4 hover:underline"
							>
								Track progress on the Jobs page
							</Link>
							.
							{user.plan === "free" ? (
								<>
									{" "}
									Your free video will be available for{" "}
									{humanizeRetentionHours(FREE_TIER_RETENTION_HOURS)} after
									it&rsquo;s ready, then deleted.
								</>
							) : null}
						</p>
					</div>
				</div>
			) : null}

			{/* Error state */}
			{error ? (
				<p className="rounded-xl border border-destructive/30 bg-destructive/8 px-5 py-3.5 text-sm text-destructive">
					{error}
				</p>
			) : null}
		</div>
	);
}
