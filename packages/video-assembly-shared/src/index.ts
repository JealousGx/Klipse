/**
 * Shared types for **video assembly** handoff (main app orchestrates; encoder runs in
 * `packages/external-video-processor` only).
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

/** App → external processor: presigned PUT + webhook; encoding/watermark only in the processor. */
export type VideoProcessorHandoffPayload = {
	jobId: string;
	userId: string;
	presignedPutUrl: string;
	contentType: string;
	completeWebhookUrl: string;
	/** FEATURE_DOC §10.3 — free tier: centered watermark in the processor. */
	freeTierWatermark: boolean;
	/** Shown inside the watermark (e.g. app title). */
	watermarkLabel: string;
	/** Content pipeline: script for future graphs; processor may fetch assets below. */
	scriptText?: string;
	/** HTTPS image URLs (e.g. Pollinations) — processor fetches; not stored in app R2. */
	imageUrls?: string[];
	/** HTTPS audio URL (e.g. Pollinations TTS GET). */
	ttsAudioUrl?: string;
};
