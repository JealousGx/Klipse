import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/billing")({
	staticData: { dashboardTitle: "Billing" },
	component: BillingPage,
});

function BillingPage() {
	return (
		<section className="max-w-2xl border-l-2 border-primary/30 pl-5">
			<p className="m-0 text-sm leading-relaxed text-muted-foreground">
				Plan, credits, and Polar checkout will wire through{" "}
				<code className="rounded-md border border-border bg-muted/60 px-2 py-0.5 font-mono text-xs text-foreground">
					GET /api/billing
				</code>{" "}
				and upgrade actions.
			</p>
		</section>
	);
}
