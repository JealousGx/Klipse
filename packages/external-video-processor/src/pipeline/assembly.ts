import { readFile } from "node:fs/promises";
import type { VideoProcessorHandoffPayload } from "@klipse/video-assembly-shared";
import { uploadBufferToPresignedUrl } from "../utils/r2-upload";
import { withRetries } from "../utils/retry";
import { cleanupFiles, tmpPath } from "../utils/temp-file";
import { applyWatermark } from "../watermark/index";

async function runPlaceholderPipeline(
	payload: VideoProcessorHandoffPayload,
	cleanup: string[],
): Promise<void> {
	const { execFile } = await import("node:child_process");
	const { promisify } = await import("node:util");
	const execFileAsync = promisify(execFile);
	const { ffmpegBin } = await import("../ffmpeg/probe");

	const tmpRaw = tmpPath("raw.mp4");
	const tmpFinal = tmpPath("out.mp4");
	cleanup.push(tmpRaw, tmpFinal);

	const placeholderArgs = [
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
		tmpRaw,
	];
	await withRetries("ffmpeg_placeholder", 3, () =>
		execFileAsync(ffmpegBin(), placeholderArgs, {
			timeout: 120_000,
			maxBuffer: 10 * 1024 * 1024,
		}),
	);

	if (payload.freeTierWatermark) {
		await withRetries("watermark", 3, () =>
			applyWatermark(tmpRaw, tmpFinal, payload.watermarkLabel),
		);
	}

	const videoPath = payload.freeTierWatermark ? tmpFinal : tmpRaw;
	const buf = await readFile(videoPath);
	await uploadBufferToPresignedUrl(
		payload.presignedPutUrl,
		buf,
		payload.contentType,
	);
}

/** Runs the assembly-only pipeline (placeholder video + watermark + R2 upload). */
export async function runAssemblyJob(
	payload: VideoProcessorHandoffPayload,
): Promise<void> {
	const cleanup: string[] = [];
	try {
		await runPlaceholderPipeline(payload, cleanup);
	} finally {
		await cleanupFiles(cleanup);
	}
}
