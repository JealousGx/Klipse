/** Shared shape for `listVideoJobsForUser` / jobs list UI (no server-only import). */
export type VideoJobListRow = {
	id: string;
	channelId: string;
	/** Which pipeline implementation produced this row (`stub_pipeline`, future kinds). */
	pipelineKind: string;
	channelName: string;
	channelNiche: string;
	channelPlatform: "unlinked" | "youtube" | "tiktok" | "instagram";
	status: "queued" | "dispatched" | "processing" | "completed" | "failed";
	progress: number;
	currentStage: string | null;
	costCredits: number;
	outputUrl: string | null;
	errorMessage: string | null;
	publishApprovalStatus: "pending" | "approved" | "rejected" | null;
	/** YouTube `videoId` after successful upload (§2.12). */
	youtubeVideoId: string | null;
	/** Last publish error message, if any. */
	publishLastError: string | null;
	/** When the output video is scheduled for purge (R2 TTL), if tracked. */
	outputStorageExpiresAt: Date | null;
	createdAt: Date;
};
