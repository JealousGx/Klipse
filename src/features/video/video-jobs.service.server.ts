import "@tanstack/react-start/server-only";

import { and, desc, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { channels } from "@/db/schema/channels";
import { expiringAssets } from "@/db/schema/expiring-assets";
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
			publishApprovalStatus: videoJobs.publishApprovalStatus,
			outputStorageExpiresAt: expiringAssets.expiresAt,
			createdAt: videoJobs.createdAt,
		})
		.from(videoJobs)
		.innerJoin(channels, eq(videoJobs.channelId, channels.id))
		.leftJoin(
			expiringAssets,
			and(
				eq(expiringAssets.videoJobId, videoJobs.id),
				eq(expiringAssets.kind, "output"),
			),
		)
		.where(eq(videoJobs.userId, userId))
		.orderBy(desc(videoJobs.createdAt))
		.limit(limit);

	return rows;
}

export async function setPublishApprovalForUser(input: {
	userId: string;
	jobId: string;
	decision: "approved" | "rejected";
}): Promise<
	{ ok: true } | { ok: false; code: "not_found" | "invalid_state" }
> {
	const db = getDb();
	const jobId = input.jobId.trim();

	const [row] = await db
		.select({
			id: videoJobs.id,
			userId: videoJobs.userId,
			publishApprovalStatus: videoJobs.publishApprovalStatus,
			status: videoJobs.status,
		})
		.from(videoJobs)
		.where(eq(videoJobs.id, jobId))
		.limit(1);

	if (!row || row.userId !== input.userId) {
		return { ok: false, code: "not_found" };
	}
	if (row.publishApprovalStatus !== "pending") {
		return { ok: false, code: "invalid_state" };
	}
	if (row.status !== "completed") {
		return { ok: false, code: "invalid_state" };
	}

	await db
		.update(videoJobs)
		.set({
			publishApprovalStatus: input.decision,
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(videoJobs.id, jobId),
				eq(videoJobs.userId, input.userId),
				eq(videoJobs.publishApprovalStatus, "pending"),
			),
		);

	return { ok: true };
}
