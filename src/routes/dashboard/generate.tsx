import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";

import { useDashboardRouteContext } from "@/context/useDashboardRouteContext";
import {
	estimateContentPipelineCredits,
	runContentPipeline,
} from "@/features/video/content-pipeline";
import {
	estimateStubGenerateCredits,
	runStubGenerate,
} from "@/features/video/stub-generate";
import {
	estimateVideoAssemblyCredits,
	runVideoAssembly,
} from "@/features/video/video-assembly";
import { authClient } from "@/lib/auth/client";

import { channelsQueryOptions } from "@/lib/queries/dashboard-queries";

export const Route = createFileRoute("/dashboard/generate")({
	staticData: { dashboardTitle: "Generate" },
	component: GeneratePage,
});

const selectClass =
	"flex h-10 w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

function GeneratePage() {
	const queryClient = useQueryClient();
	const router = useRouter();
	const { refetch: refetchSession } = authClient.useSession();
	const { session } = useDashboardRouteContext();
	const user = session.user;
	const estimate = estimateStubGenerateCredits();
	const assemblyEstimate = estimateVideoAssemblyCredits();

	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const idempotencyKeyRef = useRef<string | null>(null);
	const assemblyIdempotencyKeyRef = useRef<string | null>(null);
	const contentIdempotencyKeyRef = useRef<string | null>(null);
	const [channelId, setChannelId] = useState<string>("");
	const [idea, setIdea] = useState("");

	const contentEstimate = estimateContentPipelineCredits({ idea });

	const channelsQuery = useQuery(channelsQueryOptions);

	const channels = channelsQuery.data ?? [];

	const handleStubGenerate = async () => {
		if (!channelId) {
			setError("Choose a channel first.");
			return;
		}
		if (!idempotencyKeyRef.current) {
			idempotencyKeyRef.current = crypto.randomUUID();
		}
		const idempotencyKey = idempotencyKeyRef.current;

		setBusy(true);
		setMessage(null);
		setError(null);
		try {
			const r = await runStubGenerate({
				data: { channelId, idempotencyKey },
			});
			if (r.ok) {
				idempotencyKeyRef.current = null;
				const replayNote = r.replayed
					? " (idempotent replay — no extra charge)"
					: "";
				setMessage(
					`Charged ${r.creditsCharged} credits. Job ${r.ref}. Balance now ${r.creditsRemaining}.${replayNote}`,
				);
				if (r.creditsConsumed) {
					await refetchSession({ query: { disableCookieCache: true } });
				}
				await router.invalidate();
				void queryClient.invalidateQueries({ queryKey: ["video-jobs"] });
				void channelsQuery.refetch();
			} else if (r.code === "insufficient_credits") {
				setError(
					`Need ${r.required} credits; you have ${r.remaining}. Add credits under Billing.`,
				);
			} else if (r.code === "channel_not_found") {
				setError("That channel no longer exists. Refresh and pick again.");
			} else {
				setError("Sign in required.");
			}
		} catch (e) {
			setError(e instanceof Error ? e.message : "Something went wrong.");
		} finally {
			setBusy(false);
		}
	};

	const handleVideoAssembly = async () => {
		if (!channelId) {
			setError("Choose a channel first.");
			return;
		}
		if (!assemblyIdempotencyKeyRef.current) {
			assemblyIdempotencyKeyRef.current = crypto.randomUUID();
		}
		const idempotencyKey = assemblyIdempotencyKeyRef.current;

		setBusy(true);
		setMessage(null);
		setError(null);
		try {
			const r = await runVideoAssembly({
				data: { channelId, idempotencyKey },
			});
			if (r.ok) {
				assemblyIdempotencyKeyRef.current = null;
				const replayNote = r.replayed
					? " (idempotent replay — no extra charge)"
					: "";
				setMessage(
					`Video assembly: charged ${r.creditsCharged} credits. Job ${r.ref}. Output uploads to storage when encoding finishes. Balance ${r.creditsRemaining}.${replayNote}`,
				);
				if (r.creditsConsumed) {
					await refetchSession({ query: { disableCookieCache: true } });
				}
				await router.invalidate();
				void queryClient.invalidateQueries({ queryKey: ["video-jobs"] });
				void channelsQuery.refetch();
			} else if (r.code === "insufficient_credits") {
				setError(
					`Need ${r.required} credits; you have ${r.remaining}. Add credits under Billing.`,
				);
			} else if (r.code === "channel_not_found") {
				setError("That channel no longer exists. Refresh and pick again.");
			} else if (r.code === "free_tier_video_exhausted") {
				setError(
					"Free tier includes one successful assembly job. Upgrade for more, or use the stub pipeline for integration testing.",
				);
			} else {
				setError("Sign in required.");
			}
		} catch (e) {
			setError(e instanceof Error ? e.message : "Something went wrong.");
		} finally {
			setBusy(false);
		}
	};

	const handleContentPipeline = async () => {
		if (!channelId) {
			setError("Choose a channel first.");
			return;
		}
		const trimmed = idea.trim();
		if (trimmed.length < 3) {
			setError("Add a short video idea (at least 3 characters).");
			return;
		}
		if (!contentIdempotencyKeyRef.current) {
			contentIdempotencyKeyRef.current = crypto.randomUUID();
		}
		const idempotencyKey = contentIdempotencyKeyRef.current;

		setBusy(true);
		setMessage(null);
		setError(null);
		try {
			const r = await runContentPipeline({
				data: { channelId, idempotencyKey, idea: trimmed },
			});
			if (r.ok) {
				contentIdempotencyKeyRef.current = null;
				const replayNote = r.replayed
					? " (idempotent replay — no extra charge)"
					: "";
				setMessage(
					`Script + assembly: charged ${r.creditsCharged} credits. Job ${r.ref}. Script runs first, then encode + upload. Balance ${r.creditsRemaining}.${replayNote}`,
				);
				if (r.creditsConsumed) {
					await refetchSession({ query: { disableCookieCache: true } });
				}
				await router.invalidate();
				void queryClient.invalidateQueries({ queryKey: ["video-jobs"] });
				void channelsQuery.refetch();
			} else if (r.code === "insufficient_credits") {
				setError(
					`Need ${r.required} credits; you have ${r.remaining}. Add credits under Billing.`,
				);
			} else if (r.code === "channel_not_found") {
				setError("That channel no longer exists. Refresh and pick again.");
			} else if (r.code === "free_tier_video_exhausted") {
				setError(
					"Free tier includes one successful video job. Upgrade for more, or use the stub pipeline for integration testing.",
				);
			} else {
				setError("Sign in required.");
			}
		} catch (e) {
			setError(e instanceof Error ? e.message : "Something went wrong.");
		} finally {
			setBusy(false);
		}
	};

	return (
		<section className="max-w-2xl space-y-6">
			<div className="space-y-2 border-l-2 border-primary/30 pl-5">
				<p className="m-0 text-sm leading-relaxed text-muted-foreground">
					Choose a{" "}
					<strong className="font-medium text-foreground">
						publishing destination
					</strong>
					. The stub pipeline charges credits, writes a{" "}
					<strong className="font-medium text-foreground">video_jobs</strong>{" "}
					row ({`queued → processing → done`}), then syncs usage to Polar. When
					you connect a platform on that destination, uploads will follow the
					same job model—surface-specific code plugs in behind{" "}
					<code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
						pipeline_kind
					</code>
					, not inside this page.
				</p>
				<p className="m-0 text-sm text-muted-foreground">
					<strong className="font-medium text-foreground">Balance:</strong>{" "}
					{user.creditsRemaining ?? 0} credits ·{" "}
					<strong className="font-medium text-foreground">
						Stub estimate:
					</strong>{" "}
					{estimate} ·{" "}
					<strong className="font-medium text-foreground">
						Assembly estimate:
					</strong>{" "}
					{assemblyEstimate} (encode + upload; handled by the external video
					processor service) ·{" "}
					<strong className="font-medium text-foreground">
						Script + assembly:
					</strong>{" "}
					{contentEstimate} (AI script: Pollinations → Gemini, then encode; use
					DB table{" "}
					<code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
						provider_api_keys
					</code>{" "}
					or env{" "}
					<code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
						POLLINATIONS_API_KEY
					</code>{" "}
					/{" "}
					<code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
						GEMINI_API_KEYS
					</code>
					; routing is documented in{" "}
					<code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
						src/features/ai/config/model-routing.ts
					</code>
					)
				</p>
			</div>

			<div className="space-y-2">
				<label
					htmlFor="gen-channel"
					className="text-sm font-medium text-foreground"
				>
					Publishing destination
				</label>
				{channelsQuery.isPending ? (
					<p className="text-sm text-muted-foreground">Loading destinations…</p>
				) : channels.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						No publishing destinations. Open{" "}
						<Link
							to="/dashboard/publishing"
							className="font-medium text-primary underline-offset-4 hover:underline"
						>
							Publishing
						</Link>{" "}
						— a default destination is created for you there.
					</p>
				) : (
					<select
						id="gen-channel"
						className={selectClass}
						value={channelId}
						onChange={(e) => setChannelId(e.target.value)}
					>
						<option value="">Select a destination…</option>
						{channels.map((c) => (
							<option key={c.id} value={c.id}>
								{c.name} — {c.niche}
							</option>
						))}
					</select>
				)}
			</div>

			<div className="space-y-2">
				<label
					htmlFor="gen-idea"
					className="text-sm font-medium text-foreground"
				>
					Video idea (script + assembly)
				</label>
				<textarea
					id="gen-idea"
					rows={4}
					placeholder="e.g. 3 surprising facts about ocean microbes for science-curious viewers…"
					className={`${selectClass} min-h-24 resize-y py-2`}
					value={idea}
					onChange={(e) => setIdea(e.target.value)}
					disabled={busy}
				/>
			</div>

			<div className="flex flex-wrap items-center gap-3">
				<Button
					type="button"
					disabled={busy || !channelId || channels.length === 0}
					onClick={() => void handleStubGenerate()}
				>
					{busy ? "Running…" : "Run stub generate"}
				</Button>
				<Button
					type="button"
					variant="secondary"
					disabled={busy || !channelId || channels.length === 0}
					onClick={() => void handleVideoAssembly()}
				>
					{busy ? "Running…" : "Run video assembly (sample encode)"}
				</Button>
				<Button
					type="button"
					variant="default"
					className="bg-primary"
					disabled={
						busy ||
						!channelId ||
						channels.length === 0 ||
						idea.trim().length < 3
					}
					onClick={() => void handleContentPipeline()}
				>
					{busy ? "Running…" : "Run script + assembly"}
				</Button>
				<Button type="button" variant="outline" asChild>
					<Link to="/dashboard/jobs">View jobs</Link>
				</Button>
			</div>

			{message ? (
				<p className="m-0 rounded-lg border border-border/80 bg-muted/30 px-4 py-3 text-sm text-foreground">
					{message}
				</p>
			) : null}
			{error ? (
				<p className="m-0 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
					{error}
				</p>
			) : null}
		</section>
	);
}
