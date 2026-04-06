/**
 * Shared types + FFmpeg helpers for **video assembly** jobs (app + external processor).
 * Intentionally free of DB imports and platform-specific (YouTube, duration, etc.) coupling.
 */

/** Default object key for assembled MP4 under a job (pairs with app `publicUrlForR2Key`). */
export function videoJobAssemblyOutputKey(
	userId: string,
	jobId: string,
): string {
	const u = userId.trim();
	const j = jobId.trim();
	return `u/${u}/j/${j}/output.mp4`;
}

/** App → external processor: opaque presigned PUT URL + callback URL (no bucket credentials on the worker). */
export type VideoProcessorHandoffPayload = {
	jobId: string;
	userId: string;
	presignedPutUrl: string;
	contentType: string;
	completeWebhookUrl: string;
};

/**
 * Placeholder lavfi graph for **integration / dev** — replace with pipeline-specific
 * filters and settings for real product output (any format, length, or destination).
 */
export function integrationPlaceholderFfmpegArgs(outputPath: string): string[] {
	return [
		"-y",
		"-f",
		"lavfi",
		"-i",
		"testsrc=duration=5:size=1280x720:rate=30",
		"-c:v",
		"libx264",
		"-preset",
		"ultrafast",
		"-crf",
		"28",
		"-pix_fmt",
		"yuv420p",
		"-an",
		"-t",
		"5",
		outputPath,
	];
}
