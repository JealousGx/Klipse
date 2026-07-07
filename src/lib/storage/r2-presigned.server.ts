import "@tanstack/react-start/server-only"

import type { ProcessorPresignedUrls } from "@klipse/video-assembly-shared"

import { getSignedUrlForUpload } from "./r2.server"

const PRESIGN_TTL_S = 3600 // 1h — generous window for script + video generation

/**
 * Generates the presigned PUT URL for the final output video of a content pipeline job.
 * Processor uploads directly to R2 using this URL — no R2 credentials needed in the processor.
 */
export async function generateJobPresignedUrls(input: {
	userId: string
	jobId: string
}): Promise<ProcessorPresignedUrls> {
	const base = `u/${input.userId}/j/${input.jobId}`

	const { signedUrl: outputVideo } = await getSignedUrlForUpload(
		`${base}/output.mp4`,
		"video/mp4",
		{ expiresIn: PRESIGN_TTL_S },
	)

	return { outputVideo }
}
