import { queryOptions } from "@tanstack/react-query";

import { getAnalyticsSummaryFn } from "@/features/analytics/analytics.functions";
import { getChannelFn, listChannelsFn } from "@/features/channels/channels.functions";
import { getChannelScheduleFn } from "@/features/scheduling/scheduling.functions";
import type { VideoJobListRow } from "@/features/video/video-job-list.types";
import { listVideoJobsFn } from "@/features/video/video-jobs.functions";

// ---------------------------------------------------------------------------
// Stale-time constants
// ---------------------------------------------------------------------------

/** Channels, schedules, channel details — change only on explicit user action. */
const STALE_GENERAL_MS = 30_000;

/**
 * Job list — completed/published jobs never change, so a 2-minute stale window
 * is fine.  Active jobs are kept live by POLL_INTERVAL_MS via refetchInterval,
 * which fires independently of staleTime.
 */
const STALE_JOBS_MS = 2 * 60 * 1_000;

/** How often to re-fetch the job list while at least one job is in-flight. */
const POLL_INTERVAL_MS = 5_000;

// ---------------------------------------------------------------------------
// Job status helpers
// ---------------------------------------------------------------------------

/**
 * Statuses that mean the job is still in-flight and the user is waiting for
 * an update.  Typed to VideoJobListRow["status"] so TypeScript will break here
 * if a new status is added to the union without being consciously classified.
 */
const ACTIVE_JOB_STATUSES = new Set<VideoJobListRow["status"]>([
	"queued",
	"dispatched",
	"processing",
]);

/** True when any job in the list needs live progress updates. */
function hasActiveJobs(jobs: VideoJobListRow[]): boolean {
	return jobs.some((j) => ACTIVE_JOB_STATUSES.has(j.status));
}

/** Stale time for analytics — aggregate stats, fine to cache for 1 minute. */
const STALE_ANALYTICS_MS = 60_000;

// ---------------------------------------------------------------------------
// Query options
// ---------------------------------------------------------------------------

export const channelsQueryOptions = queryOptions({
	queryKey: ["channels"] as const,
	queryFn: async () => {
		const r = await listChannelsFn();
		if (!r.ok) throw new Error("Unauthorized");
		return r.channels;
	},
	staleTime: STALE_GENERAL_MS,
});

export function channelQueryOptions(destinationId: string) {
	return queryOptions({
		queryKey: ["channel", destinationId] as const,
		queryFn: async () => {
			const r = await getChannelFn({ data: { channelId: destinationId } });
			if (!r.ok) throw new Error(r.code);
			return r.channel;
		},
		staleTime: STALE_GENERAL_MS,
	});
}

export const videoJobsQueryOptions = queryOptions({
	queryKey: ["video-jobs"] as const,
	queryFn: async () => {
		const r = await listVideoJobsFn();
		if (!r.ok) throw new Error("Unauthorized");
		return r.jobs;
	},
	staleTime: STALE_JOBS_MS,
	refetchInterval: (query) => {
		const jobs = query.state.data;
		return jobs && hasActiveJobs(jobs) ? POLL_INTERVAL_MS : false;
	},
});

/**
 * Analytics summary — shared between the Analytics page and Billing page hero metric.
 * Single queryKey so both pages read from the same cache slot.
 * queryFn throws on unauthorized so TanStack Query surfaces it as an error state.
 */
export const analyticsQueryOptions = queryOptions({
	queryKey: ["analytics-summary"] as const,
	queryFn: async () => {
		const r = await getAnalyticsSummaryFn();
		if (!r.ok) throw new Error("Unauthorized");
		return r.summary;
	},
	staleTime: STALE_ANALYTICS_MS,
});

export function schedulingQueryOptions(channelId: string) {
	return queryOptions({
		queryKey: ["schedule", channelId] as const,
		queryFn: async () => {
			const r = await getChannelScheduleFn({ data: { channelId } });
			if (!r.ok) throw new Error("Unauthorized");
			return r.schedule;
		},
		staleTime: STALE_GENERAL_MS,
	});
}
