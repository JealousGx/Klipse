import "@tanstack/react-start/server-only";

import type { ProcessorPresignedUrls } from "@klipse/video-assembly-shared";

import { getSignedUrlForUpload } from "./r2.server";

/** Must match IMAGE_COUNT in the processor. */
export const IMAGE_COUNT = 3;

const PRESIGN_TTL_S = 3600; // 1h — generous window for script + prepare + assemble

/**
 * Generates all presigned PUT URLs for a content pipeline job.
 * Processor uploads directly to R2 using these URLs — no R2 credentials needed in the processor.
 */
export async function generateJobPresignedUrls(input: {
	userId: string;
	jobId: string;
	withSound: boolean;
}): Promise<ProcessorPresignedUrls> {
	const base = `u/${input.userId}/j/${input.jobId}`;
	const opts = { expiresIn: PRESIGN_TTL_S };

	const [tts, ...imageSigns] = await Promise.all([
		getSignedUrlForUpload(`${base}/tts.mp3`, "audio/mpeg", opts),
		...Array.from({ length: IMAGE_COUNT }, (_, i) =>
			getSignedUrlForUpload(`${base}/img-${i}.webp`, "image/webp", opts),
		),
	]);

	const soundSign = input.withSound
		? await getSignedUrlForUpload(`${base}/sound.mp3`, "audio/mpeg", opts)
		: null;

	const { signedUrl: outputVideo } = await getSignedUrlForUpload(
		`${base}/output.mp4`,
		"video/mp4",
		opts,
	);

	return {
		ttsAudio: tts.signedUrl,
		images: imageSigns.map((r) => r.signedUrl),
		soundAudio: soundSign?.signedUrl ?? null,
		outputVideo,
	};
}
