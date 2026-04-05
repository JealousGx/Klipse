/** Shared shape for `listVideoJobsForUser` / jobs list UI (no server-only import). */
export type VideoJobListRow = {
	id: string;
	channelId: string;
	channelName: string;
	channelNiche: string;
	channelPlatform: "unlinked" | "youtube" | "tiktok" | "instagram";
	status: "queued" | "processing" | "completed" | "failed";
	progress: number;
	currentStage: string | null;
	costCredits: number;
	outputUrl: string | null;
	errorMessage: string | null;
	createdAt: Date;
};
