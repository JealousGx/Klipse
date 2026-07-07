/**
 * Discriminator for which pipeline worker / handler processes a `video_jobs` row.
 * Values are **versioned implementation hooks**, not publishing platforms or clip lengths
 * — use `channels.platform` for YouTube/TikTok/etc.
 */
export const PIPELINE_KIND = {
	/**
	 * Script → single-call self-hosted video+audio generation (external processor) → `done`.
	 */
	CONTENT_PIPELINE_V1: "content_pipeline_v1",
} as const

export type PipelineKind = (typeof PIPELINE_KIND)[keyof typeof PIPELINE_KIND]

export const PIPELINE_STAGE = {
	QUEUED: "queued",
	/** External processor handoff in progress (Hono not yet accepted). */
	DISPATCH_PENDING: "dispatch_pending",
	/** AI script generation — produces the single comprehensive video_prompt. */
	SCRIPT: "script",
	/** Self-hosted model call: single-pass multi-scene video+audio generation, watermark, upload. */
	VIDEO_GEN: "video_gen",
	DONE: "done",
} as const

export type PipelineStage = (typeof PIPELINE_STAGE)[keyof typeof PIPELINE_STAGE]

/** User-facing label for a pipeline kind (job list / detail). */
export function labelForPipelineKind(kind: string): string {
	switch (kind) {
		case PIPELINE_KIND.CONTENT_PIPELINE_V1:
			return "Full video"
		default:
			return kind
	}
}

/** User-facing label for a pipeline stage shown in progress indicators. */
export function labelForPipelineStage(
	stage: string | null | undefined,
): string {
	switch (stage) {
		case PIPELINE_STAGE.QUEUED:
			return "Waiting"
		case PIPELINE_STAGE.DISPATCH_PENDING:
			return "Preparing"
		case PIPELINE_STAGE.SCRIPT:
			return "Writing script"
		case PIPELINE_STAGE.VIDEO_GEN:
			return "Generating video"
		case PIPELINE_STAGE.DONE:
			return "Done"
		default:
			return stage ?? "—"
	}
}
