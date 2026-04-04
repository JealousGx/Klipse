import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/analytics")({
	staticData: { dashboardTitle: "Analytics" },
	component: AnalyticsPage,
});

function AnalyticsPage() {
	return (
		<section className="max-w-2xl border-l-2 border-primary/30 pl-5">
			<p className="m-0 text-sm leading-relaxed text-muted-foreground">
				Views, watch time, and retention will aggregate from stored metrics and
				optional YouTube webhooks.
			</p>
		</section>
	);
}
