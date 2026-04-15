/**
 * Shared types for video assembly and the full content pipeline processor handoff.
 */

// Assembly-only pipeline (video_assemble_v1) — backward compat.
export {
	videoJobAssemblyOutputKey,
	type VideoProcessorHandoffPayload,
} from "./assembly-types";

// Full content pipeline (content_pipeline_v1) — ProcessorJobSpec sent to Cloud Run.
export type {
	ProcessorProviderKey,
	ProcessorProviderKeys,
	ProcessorPresignedUrls,
	ProcessorJobSpec,
} from "./processor-spec";

// Processor → main app callback payload types.
export type {
	ProcessorProgressPayload,
	ProcessorKeyFailureProvider,
	ProcessorKeyFailurePayload,
	ProcessorCompletePayload,
} from "./processor-callbacks";
