import { execFile } from "node:child_process";
import { unlink, writeFile } from "node:fs/promises";
import { promisify } from "node:util";

import { ffmpegBin } from "../ffmpeg/probe";

const execFileAsync = promisify(execFile);
const FFMPEG_OPTS = { timeout: 600_000, maxBuffer: 80 * 1024 * 1024 };

// Explicit font path — avoids fontconfig family lookup ("Cannot find a valid font for the family Sans")
// in Alpine-based Docker images where only ttf-dejavu is installed.
const FONT_FILE = "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf";
const WATERMARK_STYLE = `fontfile=${FONT_FILE}:fontcolor=white@0.78:fontsize=36:box=1:boxcolor=black@0.38:boxborderw=8:x=(w-text_w)/2:y=(h-text_h)/2`;

function drawtext(textFilePath: string): string {
	const safe = textFilePath.replace(/\\/g, "/").replace(/:/g, "\\:");
	return `drawtext=textfile=${safe}:${WATERMARK_STYLE}`;
}

/** Applies a centered text watermark to a video (video-only, no audio). */
export async function applyWatermark(
	inputPath: string,
	outputPath: string,
	label: string,
): Promise<void> {
	const labelPath = `${outputPath}.wm-label.txt`;
	await writeFile(labelPath, label, "utf8");
	try {
		await execFileAsync(
			ffmpegBin(),
			[
				"-y",
				"-i",
				inputPath,
				"-vf",
				drawtext(labelPath),
				"-map",
				"0:v:0",
				"-c:v",
				"libx264",
				"-preset",
				"veryfast",
				"-crf",
				"23",
				"-pix_fmt",
				"yuv420p",
				"-movflags",
				"+faststart",
				"-an",
				outputPath,
			],
			FFMPEG_OPTS,
		);
	} finally {
		await unlink(labelPath).catch(() => {});
	}
}

/** Applies a centered text watermark while preserving the first audio stream. */
export async function applyWatermarkWithAudio(
	inputPath: string,
	outputPath: string,
	label: string,
): Promise<void> {
	const labelPath = `${outputPath}.wm-label.txt`;
	await writeFile(labelPath, label, "utf8");
	try {
		await execFileAsync(
			ffmpegBin(),
			[
				"-y",
				"-i",
				inputPath,
				"-vf",
				drawtext(labelPath),
				"-map",
				"0:v:0",
				"-map",
				"0:a:0",
				"-c:v",
				"libx264",
				"-preset",
				"veryfast",
				"-crf",
				"23",
				"-pix_fmt",
				"yuv420p",
				"-c:a",
				"aac",
				"-b:a",
				"192k",
				"-movflags",
				"+faststart",
				outputPath,
			],
			FFMPEG_OPTS,
		);
	} finally {
		await unlink(labelPath).catch(() => {});
	}
}
