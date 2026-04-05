import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";

import { useDashboardRouteContext } from "@/context/useDashboardRouteContext";

import {
	estimateStubGenerateCredits,
	runStubGenerate,
} from "@/features/video/stub-generate";

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
	const { session } = useDashboardRouteContext();
	const user = session.user;
	const estimate = estimateStubGenerateCredits();
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const idempotencyKeyRef = useRef<string | null>(null);
	const [channelId, setChannelId] = useState<string>("");

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

	return (
		<section className="max-w-2xl space-y-6">
			<div className="space-y-2 border-l-2 border-primary/30 pl-5">
				<p className="m-0 text-sm leading-relaxed text-muted-foreground">
					Choose a{" "}
					<strong className="font-medium text-foreground">
						publishing destination
					</strong>{" "}
					(stub uses the same IDs until OAuth connectors land). Then run the
					stub pipeline: estimate → balance check → deduct + ledger + Polar
					usage outbox +{" "}
					<strong className="font-medium text-foreground">video_jobs</strong>{" "}
					row. Uploads will target whatever platform account you link here
					(YouTube first, then others on the same model).
				</p>
				<p className="m-0 text-sm text-muted-foreground">
					<strong className="font-medium text-foreground">Balance:</strong>{" "}
					{user.creditsRemaining ?? 0} credits ·{" "}
					<strong className="font-medium text-foreground">
						Stub estimate:
					</strong>{" "}
					{estimate} credits
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

			<div className="flex flex-wrap items-center gap-3">
				<Button
					type="button"
					disabled={busy || !channelId || channels.length === 0}
					onClick={() => void handleStubGenerate()}
				>
					{busy ? "Running…" : "Run stub generate"}
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
