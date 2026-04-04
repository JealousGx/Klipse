import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/jobs")({
	staticData: { dashboardTitle: "Jobs" },
	component: JobsPage,
});

function JobsPage() {
	return (
		<section className="max-w-2xl border-l-2 border-primary/30 pl-5">
			<p className="m-0 text-sm leading-relaxed text-muted-foreground">
				Video jobs list with status will load from{" "}
				<code className="rounded-md border border-border bg-muted/60 px-2 py-0.5 font-mono text-xs text-foreground">
					GET /api/jobs
				</code>{" "}
				with batched queries (no N+1).
			</p>
		</section>
	);
}
