import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { JobQueueStoryCard } from "@/components/dashboard/pipeline-story";
import { videoJobsQueryOptions } from "@/lib/queries/dashboard-queries";

export const Route = createFileRoute("/_authed/dashboard/jobs")({
	staticData: { dashboardTitle: "Jobs" },
	beforeLoad: ({ context }) => {
		void context.queryClient.ensureQueryData(videoJobsQueryOptions);
	},
	component: JobsPage,
});

function JobsPage() {
	const jobsQuery = useQuery(videoJobsQueryOptions);

	const jobs = jobsQuery.data ?? [];
	const loading = jobsQuery.isPending;

	return (
		<div className="space-y-6">
			<div>
				<h2 className="font-heading text-lg font-semibold text-foreground">
					Video jobs
				</h2>
				<p className="mt-1 max-w-2xl text-sm text-muted-foreground">
					Each video your channels generate appears here. Track status, download
					finished videos, or retry if something went wrong.
				</p>
			</div>

			{!loading && jobs.length === 0 ? (
				<div className="rounded-xl border border-dashed border-border/80 bg-muted/10 px-6 py-12 text-center text-sm text-muted-foreground">
					No jobs yet.{" "}
					<Link
						to="/dashboard/generate"
						className="font-medium text-primary underline-offset-4 hover:underline"
					>
						Run generate
					</Link>{" "}
					on a channel to create one.
				</div>
			) : (
				<JobQueueStoryCard
					jobs={jobs}
					isLoading={loading}
					onRefetch={() => void jobsQuery.refetch()}
					isRefetching={jobsQuery.isFetching && !jobsQuery.isPending}
				/>
			)}
		</div>
	)
}
