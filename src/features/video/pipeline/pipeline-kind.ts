/**
 * Discriminator for which pipeline worker / handler processes a `video_jobs` row.
 * Keep values short and stable; add new kinds when you introduce real renders or
 * platform-specific publish steps — not the same as `channels.platform`.
 */
export const PIPELINE_KIND = {
	/** Dev / billing integration: instant fake stages until real media workers exist. */
	STUB_PIPELINE: "stub_pipeline",
} as const;

export type PipelineKind = (typeof PIPELINE_KIND)[keyof typeof PIPELINE_KIND];

export const PIPELINE_STAGE = {
	QUEUED: "queued",
	STUB_RUN: "stub_run",
	DONE: "done",
} as const;

export type PipelineStage =
	(typeof PIPELINE_STAGE)[keyof typeof PIPELINE_STAGE];

/** User-facing labels for job list / detail (extend when you add real stages). */
export function labelForPipelineKind(kind: string): string {
	switch (kind) {
		case PIPELINE_KIND.STUB_PIPELINE:
			return "Stub pipeline";
		default:
			return kind;
	}
}
