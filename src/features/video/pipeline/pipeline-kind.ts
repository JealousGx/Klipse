/**
 * Discriminator for which pipeline worker / handler processes a `video_jobs` row.
 * Values are **versioned implementation hooks**, not publishing platforms or clip lengths
 * — use `channels.platform` for YouTube/TikTok/etc.
 */
export const PIPELINE_KIND = {
	/** Dev / billing integration: instant fake stages until real media workers exist. */
	STUB_PIPELINE: "stub_pipeline",
	/**
	 * Encode / mux / assemble output and upload to storage (`assemble` stage).
	 * Slug is versioned only; duration and destination are pipeline-internal.
	 */
	VIDEO_ASSEMBLE_V1: "video_assemble_v1",
	/**
	 * Script (AI) → video assembly: `current_stage` moves `script` → `assemble` → `done`.
	 */
	CONTENT_PIPELINE_V1: "content_pipeline_v1",
} as const;

export type PipelineKind = (typeof PIPELINE_KIND)[keyof typeof PIPELINE_KIND];

export function isVideoAssemblyPipelineKind(kind: string): boolean {
	return kind === PIPELINE_KIND.VIDEO_ASSEMBLE_V1;
}

/** Pipelines that run FFmpeg assembly (inline or external) for this job row. */
export function isAssemblyEncodingPipelineKind(kind: string): boolean {
	return (
		kind === PIPELINE_KIND.VIDEO_ASSEMBLE_V1 ||
		kind === PIPELINE_KIND.CONTENT_PIPELINE_V1
	);
}

export const PIPELINE_STAGE = {
	QUEUED: "queued",
	/** External processor handoff in progress (Hono not yet accepted). */
	DISPATCH_PENDING: "dispatch_pending",
	/** AI script generation (content pipeline). */
	SCRIPT: "script",
	STUB_RUN: "stub_run",
	ASSEMBLE: "assemble",
	DONE: "done",
} as const;

export type PipelineStage =
	(typeof PIPELINE_STAGE)[keyof typeof PIPELINE_STAGE];

/** User-facing labels for job list / detail (extend when you add real stages). */
export function labelForPipelineKind(kind: string): string {
	switch (kind) {
		case PIPELINE_KIND.STUB_PIPELINE:
			return "Stub pipeline";
		case PIPELINE_KIND.VIDEO_ASSEMBLE_V1:
			return "Video assembly";
		case PIPELINE_KIND.CONTENT_PIPELINE_V1:
			return "Script + assembly";
		default:
			return kind;
	}
}
