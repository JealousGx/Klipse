import { createFileRoute, Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { publishingDestinationSearchSchema } from "@/features/publishing-destination/publishing-destination-search.schema";
import { PublishingDestinationView } from "@/features/publishing-destination/publishing-destination-view";
import { usePublishingDestinationPage } from "@/features/publishing-destination/use-publishing-destination-page";
import { channelQueryOptions } from "@/lib/queries/dashboard-queries";

export const Route = createFileRoute("/dashboard/publishing/$destinationId")({
	staticData: { dashboardTitle: "Publishing destination" },
	validateSearch: (raw: Record<string, unknown>) => {
		const p = publishingDestinationSearchSchema.safeParse(raw);
		return p.success ? p.data : {};
	},
	beforeLoad: async ({ context, params }) => {
		await context.queryClient.ensureQueryData(
			channelQueryOptions(params.destinationId),
		);
	},
	component: PublishingDestinationPage,
});

function PublishingDestinationPage() {
	const { destinationId } = Route.useParams();
	const search = Route.useSearch();
	const page = usePublishingDestinationPage(destinationId, search);

	if (page.status === "loading") {
		return <p className="text-sm text-muted-foreground">Loading…</p>;
	}

	if (page.status === "error") {
		return (
			<div className="space-y-4">
				<p className="text-sm text-destructive">Destination not found.</p>
				<Button type="button" variant="outline" asChild>
					<Link to="/dashboard/publishing">Back to publishing</Link>
				</Button>
			</div>
		);
	}

	return <PublishingDestinationView {...page.viewProps} />;
}
