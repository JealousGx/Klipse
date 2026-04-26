import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { JobQueueStoryCard } from "@/components/dashboard/pipeline-story";
import { CursorPagination } from "@/components/shared/pagination";
import { LIST_JOBS_DEFAULT_PAGE_SIZE } from "@/features/video/video-job-constants";
import {
	type VideoJobsPageCursor,
	videoJobsQueryOptions,
} from "@/lib/queries/dashboard-queries";

export const Route = createFileRoute("/_authed/dashboard/jobs")({
	staticData: { dashboardTitle: "Jobs" },
	beforeLoad: ({ context }) => {
		void context.queryClient.ensureQueryData(videoJobsQueryOptions());
	},
	component: JobsPage,
});

function JobsPage() {
	// Cursor stack — each entry is the cursor for that page index.
	// Index 0 = page 1 (no cursor). Stack grows as user pages forward.
	const [cursorStack, setCursorStack] = useState<VideoJobsPageCursor[]>([]);
	const [pageSize, setPageSize] = useState(LIST_JOBS_DEFAULT_PAGE_SIZE);

	const currentPage = cursorStack.length + 1;
	const currentCursor =
		cursorStack.length > 0 ? cursorStack[cursorStack.length - 1] : undefined;

	const jobsQuery = useQuery(videoJobsQueryOptions(currentCursor, pageSize));

	const jobs = jobsQuery.data?.jobs ?? [];
	const nextCursor = jobsQuery.data?.nextCursor ?? null;
	const loading = jobsQuery.isPending;

	const handleNext = () => {
		if (!nextCursor) return;
		setCursorStack((prev) => [...prev, nextCursor]);
	};

	const handlePrev = () => {
		setCursorStack((prev) => prev.slice(0, -1));
	};

	const handlePageSizeChange = (size: number) => {
		// Reset to first page on page size change.
		setCursorStack([]);
		setPageSize(size);
	};

	const hasPrev = cursorStack.length > 0;
	const hasNext = !!nextCursor;

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

			{!loading && jobs.length === 0 && currentPage === 1 ? (
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
				<>
					<JobQueueStoryCard
						jobs={jobs}
						isLoading={loading}
						onRefetch={() => void jobsQuery.refetch()}
						isRefetching={jobsQuery.isFetching && !jobsQuery.isPending}
					/>

					{(hasPrev || hasNext) && (
						<CursorPagination
							hasPrev={hasPrev}
							hasNext={hasNext}
							onPrev={handlePrev}
							onNext={handleNext}
							currentPage={currentPage}
							pageSize={pageSize}
							onPageSizeChange={handlePageSizeChange}
						/>
					)}
				</>
			)}
		</div>
	);
}
