/** Minimal artifacts subset safe for client consumption. */
export type VideoJobListRowArtifacts = {
	title?: string;
	description?: string;
	tags?: string[];
};

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
	/** Platform-assigned video id after a successful publish. */
	publishedVideoId: string | null;
	/** Last publish error message, if any. */
	publishLastError: string | null;
	/**
	 * Number of manual retries already used. UI shows Retry button when
	 * `status === "failed" && retryCount < MAX_MANUAL_RETRIES`.
	 */
	retryCount: number;
	/** When the output video is scheduled for purge (R2 TTL), if tracked. */
	outputStorageExpiresAt: Date | null;
	createdAt: Date;
	/** AI-generated metadata (title, description, tags). Null for older jobs. */
	artifacts: VideoJobListRowArtifacts | null;
};
