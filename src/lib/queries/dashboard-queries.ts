import { queryOptions } from "@tanstack/react-query";

import { getChannelFn, listChannelsFn } from "@/features/channels/channels.functions";
import { listVideoJobsFn } from "@/features/video/video-jobs.functions";

/** Shared stale time so navigations hit cache after a parent route has already loaded lists. */
const staleMs = 30_000;

export const channelsQueryOptions = queryOptions({
	queryKey: ["channels"] as const,
	queryFn: async () => {
		const r = await listChannelsFn();
		if (!r.ok) throw new Error("Unauthorized");
		return r.channels;
	},
	staleTime: staleMs,
});

export function channelQueryOptions(destinationId: string) {
	return queryOptions({
		queryKey: ["channel", destinationId] as const,
		queryFn: async () => {
			const r = await getChannelFn({ data: { channelId: destinationId } });
			if (!r.ok) throw new Error(r.code);
			return r.channel;
		},
		staleTime: staleMs,
	});
}

export const videoJobsQueryOptions = queryOptions({
	queryKey: ["video-jobs"] as const,
	queryFn: async () => {
		const r = await listVideoJobsFn();
		if (!r.ok) throw new Error("Unauthorized");
		return r.jobs;
	},
	staleTime: staleMs,
});
