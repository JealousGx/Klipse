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
	createdAt: Date;
};
