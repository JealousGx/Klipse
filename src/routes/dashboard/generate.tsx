import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useDashboardRouteContext } from "@/context/useDashboardRouteContext";
import {
	estimateStubGenerateCredits,
	runStubGenerate,
} from "@/features/video/stub-generate";

export const Route = createFileRoute("/dashboard/generate")({
	staticData: { dashboardTitle: "Generate" },
	component: GeneratePage,
});

function GeneratePage() {
	const router = useRouter();
	const { session } = useDashboardRouteContext();
	const user = session.user;
	const estimate = estimateStubGenerateCredits();
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const idempotencyKeyRef = useRef<string | null>(null);

	const handleStubGenerate = async () => {
		if (!idempotencyKeyRef.current) {
			idempotencyKeyRef.current = crypto.randomUUID();
		}
		const idempotencyKey = idempotencyKeyRef.current;

		setBusy(true);
		setMessage(null);
		setError(null);
		try {
			const r = await runStubGenerate({ data: { idempotencyKey } });
			if (r.ok) {
				idempotencyKeyRef.current = null;
				const replayNote = r.replayed
					? " (idempotent replay — no extra charge)"
					: "";
				setMessage(
					`Charged ${r.creditsCharged} credits. Job ref ${r.ref}. Balance now ${r.creditsRemaining}.${replayNote}`,
				);
				await router.invalidate();
			} else if (r.code === "insufficient_credits") {
				setError(
					`Need ${r.required} credits; you have ${r.remaining}. Add credits under Billing.`,
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
					Preview flow is stubbed: one click runs estimate → balance check →
					deduct + ledger + outbox row; Polar{" "}
					<code className="font-mono text-xs">klipse.usage</code> ingest runs
					asynchronously (retries on failure; credits are not refunded). The
					real pipeline will replace this with{" "}
					<code className="rounded-md border border-border bg-muted/60 px-2 py-0.5 font-mono text-xs text-foreground">
						POST /api/videos/generate
					</code>
					.
				</p>
				<p className="m-0 text-sm text-muted-foreground">
					<strong className="font-medium text-foreground">
						Current balance:
					</strong>{" "}
					{user.creditsRemaining ?? 0} credits ·{" "}
					<strong className="font-medium text-foreground">
						Stub estimate:
					</strong>{" "}
					{estimate} credits
				</p>
			</div>

			<div className="flex flex-wrap items-center gap-3">
				<Button
					type="button"
					disabled={busy}
					onClick={() => void handleStubGenerate()}
				>
					{busy ? "Running…" : "Run stub generate"}
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
