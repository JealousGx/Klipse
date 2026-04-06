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
} as const;

export type PipelineKind = (typeof PIPELINE_KIND)[keyof typeof PIPELINE_KIND];

export function isVideoAssemblyPipelineKind(kind: string): boolean {
	return kind === PIPELINE_KIND.VIDEO_ASSEMBLE_V1;
}

export const PIPELINE_STAGE = {
	QUEUED: "queued",
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
		default:
			return kind;
	}
}
