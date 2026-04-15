import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { ffmpegBin } from "./probe";

const execFileAsync = promisify(execFile);

const FFMPEG_OPTS = { timeout: 600_000, maxBuffer: 80 * 1024 * 1024 };

/** Dimensions for supported aspect ratios. */
const DIMENSIONS: Record<string, [number, number]> = {
	"16:9": [1280, 720],
	"9:16": [720, 1280],
	"1:1": [1080, 1080],
};

/**
 * Encodes a single image as a looped video segment of the given duration.
 * Output is a silent H.264 MP4 (no audio stream).
 */
export async function encodeImageSegment(
	imagePath: string,
	durationSec: number,
	aspectRatio: string,
	outputPath: string,
): Promise<void> {
	const [w, h] = DIMENSIONS[aspectRatio] ?? [1280, 720];
	const vf = `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,format=yuv420p`;

	await execFileAsync(
		ffmpegBin(),
		[
			"-y",
			"-loop",
			"1",
			"-i",
			imagePath,
			"-t",
			String(durationSec),
			"-vf",
			vf,
			"-c:v",
			"libx264",
			"-preset",
			"veryfast",
			"-crf",
			"23",
			"-pix_fmt",
			"yuv420p",
			"-an",
			outputPath,
		],
		FFMPEG_OPTS,
	);
}
