import "@tanstack/react-start/server-only";

import { desc, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { channels } from "@/db/schema/channels";
import { videoJobs } from "@/db/schema/video-jobs";

import type { VideoJobListRow } from "./video-job-list.types";

export type { VideoJobListRow } from "./video-job-list.types";

export async function listVideoJobsForUser(
	userId: string,
	limit = 100,
): Promise<VideoJobListRow[]> {
	const db = getDb();
	const rows = await db
		.select({
			id: videoJobs.id,
			channelId: videoJobs.channelId,
			pipelineKind: videoJobs.pipelineKind,
			channelName: channels.name,
			channelNiche: channels.niche,
			channelPlatform: channels.platform,
			status: videoJobs.status,
			progress: videoJobs.progress,
			currentStage: videoJobs.currentStage,
			costCredits: videoJobs.costCredits,
			outputUrl: videoJobs.outputUrl,
			errorMessage: videoJobs.errorMessage,
			createdAt: videoJobs.createdAt,
		})
		.from(videoJobs)
		.innerJoin(channels, eq(videoJobs.channelId, channels.id))
		.where(eq(videoJobs.userId, userId))
		.orderBy(desc(videoJobs.createdAt))
		.limit(limit);

	return rows;
}
