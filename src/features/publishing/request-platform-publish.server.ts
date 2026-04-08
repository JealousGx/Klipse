import "@tanstack/react-start/server-only";

import type { PlatformPublishMessage } from "@klipse/worker-contracts";

import { enqueuePlatformPublish } from "@/lib/worker/enqueue.server";

/**
 * Queue a platform publish for a completed job (Worker → main-app handler).
 * The worker routes to the correct internal endpoint based on `platform`.
 */
export async function requestPlatformPublishForJob(input: {
	jobId: string;
	userId: string;
	platform: PlatformPublishMessage["platform"];
}): Promise<void> {
	if (input.platform === "youtube" || input.platform === "tiktok" || input.platform === "instagram") {
		await enqueuePlatformPublish({
			jobId: input.jobId.trim(),
			userId: input.userId.trim(),
			platform: input.platform,
		});
	}
}
