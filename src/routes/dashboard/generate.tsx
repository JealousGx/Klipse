import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/generate")({
	staticData: { dashboardTitle: "Generate" },
	component: GeneratePage,
});

function GeneratePage() {
	return (
		<section className="max-w-2xl border-l-2 border-primary/30 pl-5">
			<p className="m-0 text-sm leading-relaxed text-muted-foreground">
				Idea input, preview, and enqueue will call{" "}
				<code className="rounded-md border border-border bg-muted/60 px-2 py-0.5 font-mono text-xs text-foreground">
					POST /api/videos/generate
				</code>{" "}
				after credit estimation and validation.
			</p>
		</section>
	);
}
