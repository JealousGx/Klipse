import "@tanstack/react-start/server-only";

import { enqueuePlatformPublish } from "@/lib/worker/enqueue.server";

/** Queue a YouTube upload for a completed job (Worker → main app handler). */
export async function requestYoutubePublishForJob(input: {
	jobId: string;
	userId: string;
}): Promise<void> {
	await enqueuePlatformPublish({
		jobId: input.jobId.trim(),
		userId: input.userId.trim(),
		platform: "youtube",
	});
}
