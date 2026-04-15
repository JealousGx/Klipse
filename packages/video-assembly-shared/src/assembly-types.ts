/** Default object key for assembled MP4 under a job (pairs with app `publicUrlForR2Key`). */
export function videoJobAssemblyOutputKey(
	userId: string,
	jobId: string,
): string {
	const u = userId.trim();
	const j = jobId.trim();
	return `u/${u}/j/${j}/output.mp4`;
}

/** App → external processor: presigned PUT + webhook; encoding/watermark only in the processor. */
export type VideoProcessorHandoffPayload = {
	jobId: string;
	userId: string;
	presignedPutUrl: string;
	contentType: string;
	completeWebhookUrl: string;
	/** FEATURE_DOC §10.3 — free tier: centered watermark applied by the processor. */
	freeTierWatermark: boolean;
	/** Shown inside the watermark (e.g. app title). */
	watermarkLabel: string;
	/**
	 * Target video duration in seconds, clamped to the user's plan limit.
	 * Processors should respect this; shorter content fills the remainder with silence/hold.
	 */
	targetDuration?: number;
	/**
	 * Output aspect ratio — decoupled from publishing platform so a 9:16 short can be
	 * posted to any platform that accepts it.
	 */
	aspectRatio?: "16:9" | "9:16" | "1:1";
	/** Content pipeline: script text forwarded for future encoder graphs. */
	scriptText?: string;
	/** R2 image URLs — processor fetches; registered in expiring_assets (2h TTL). */
	imageUrls?: string[];
	/** R2 URL for TTS voiceover audio. */
	ttsAudioUrl?: string;
	/** R2 URL for background sound effect — Creator+ only, absent when not generated. */
	soundAudioUrl?: string;
};
