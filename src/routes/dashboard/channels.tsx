import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/channels")({
	staticData: { dashboardTitle: "Channels" },
	component: ChannelsPage,
});

function ChannelsPage() {
	return (
		<section className="max-w-2xl border-l-2 border-primary/30 pl-5">
			<p className="m-0 text-sm leading-relaxed text-muted-foreground">
				No channels yet. Creation and editing will use{" "}
				<code className="rounded-md border border-border bg-muted/60 px-2 py-0.5 font-mono text-xs text-foreground">
					POST /api/channels
				</code>{" "}
				(services + Zod) in a follow-up.
			</p>
		</section>
	);
}
