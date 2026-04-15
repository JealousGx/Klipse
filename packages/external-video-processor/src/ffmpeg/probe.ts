import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export function ffmpegBin(): string {
	return process.env.FFMPEG_PATH?.trim() || "ffmpeg";
}

export function ffprobeBin(): string {
	return process.env.FFPROBE_PATH?.trim() || "ffprobe";
}

/** Returns audio/video duration in seconds via ffprobe. */
export async function ffprobeDuration(mediaPath: string): Promise<number> {
	const { stdout } = await execFileAsync(
		ffprobeBin(),
		[
			"-v",
			"error",
			"-show_entries",
			"format=duration",
			"-of",
			"default=noprint_wrappers=1:nokey=1",
			mediaPath,
		],
		{ timeout: 60_000, maxBuffer: 1024 * 1024 },
	);
	const v = parseFloat(String(stdout).trim());
	if (!Number.isFinite(v) || v <= 0)
		throw new Error("ffprobe_invalid_duration");
	return v;
}
