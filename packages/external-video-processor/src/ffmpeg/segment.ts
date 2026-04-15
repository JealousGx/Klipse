import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { ffmpegBin } from "./probe";

const execFileAsync = promisify(execFile);

const FFMPEG_OPTS = { timeout: 600_000, maxBuffer: 80 * 1024 * 1024 };

/** Output dimensions for supported aspect ratios. */
const DIMENSIONS: Record<string, [number, number]> = {
	"16:9": [1280, 720],
	"9:16": [720, 1280],
	"1:1": [1080, 1080],
};

const FPS = 30;

/**
 * Builds a Ken Burns (slow zoom + pan) filter chain for a video segment.
 * Three distinct motions cycle across segments to add visual variety.
 */
function buildKenBurnsFilter(
	w: number,
	h: number,
	durationSec: number,
	segmentIndex: number,
): string {
	const frames = Math.ceil(FPS * durationSec);
	// Zoom from 1.0 → 1.5 over the segment; step per frame.
	const step = (0.5 / frames).toFixed(6);
	const cx = "iw/2-(iw/zoom/2)";
	const cy = "ih/2-(ih/zoom/2)";

	// Three distinct Ken Burns motions, cycling for additional segments.
	const motions = [
		// Slow zoom in (center)
		`x='${cx}':y='${cy}'`,
		// Zoom in + pan right
		`x='min(iw-iw/zoom,${cx}+iw*0.15*on/${frames})':y='${cy}'`,
		// Zoom in + pan up
		`x='${cx}':y='max(0,${cy}-ih*0.10*on/${frames})'`,
	] as const;
	const motion = motions[segmentIndex % motions.length] as string;

	// Scale input to 1.5× output resolution so zoompan has headroom without visible upscaling.
	const scaledW = Math.ceil((w * 1.5) / 2) * 2;
	const scaledH = Math.ceil((h * 1.5) / 2) * 2;

	return [
		`scale=${scaledW}:${scaledH}:force_original_aspect_ratio=increase`,
		`crop=${scaledW}:${scaledH}`,
		`zoompan=z='min(zoom+${step},1.5)':${motion}:d=${frames}:s=${w}x${h}:fps=${FPS}`,
		"format=yuv420p",
	].join(",");
}

/**
 * Encodes a single image as a video segment with Ken Burns motion effect.
 * Output is a silent H.264 MP4 (no audio stream).
 */
export async function encodeImageSegment(
	imagePath: string,
	durationSec: number,
	aspectRatio: string,
	outputPath: string,
	segmentIndex = 0,
): Promise<void> {
	const [w, h] = DIMENSIONS[aspectRatio] ?? [720, 1280];
	const vf = buildKenBurnsFilter(w, h, durationSec, segmentIndex);

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
			"-an",
			outputPath,
		],
		FFMPEG_OPTS,
	);
}
