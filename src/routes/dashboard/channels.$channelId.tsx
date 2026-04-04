import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/channels/$channelId")({
	staticData: { dashboardTitle: "Channel" },
	component: ChannelDetailPage,
});

function ChannelDetailPage() {
	const { channelId } = Route.useParams();

	return (
		<section className="max-w-2xl space-y-4 border-l-2 border-primary/30 pl-5">
			<p className="m-0 text-sm leading-relaxed text-muted-foreground">
				Channel ID:{" "}
				<span className="font-mono text-foreground">{channelId}</span>
			</p>
			<p className="m-0 text-sm leading-relaxed text-muted-foreground">
				Blueprint, visual identity, and config will load here from the channels
				service.
			</p>
		</section>
	);
}
