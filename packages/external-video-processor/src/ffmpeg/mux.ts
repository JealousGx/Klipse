import { execFile } from "node:child_process"
import { promisify } from "node:util"

import { ffmpegBin } from "./probe"

const execFileAsync = promisify(execFile)
const FFMPEG_OPTS = { timeout: 600_000, maxBuffer: 80 * 1024 * 1024 }

/** Muxes a silent video with TTS audio. */
export async function muxVideoAudio(
	videoPath: string,
	audioPath: string,
	outputPath: string,
): Promise<void> {
	await execFileAsync(
		ffmpegBin(),
		[
			"-y",
			"-i",
			videoPath,
			"-i",
			audioPath,
			"-c:v",
			"copy",
			"-c:a",
			"aac",
			"-b:a",
			"192k",
			"-map",
			"0:v:0",
			"-map",
			"1:a:0",
			"-shortest",
			"-movflags",
			"+faststart",
			outputPath,
		],
		FFMPEG_OPTS,
	)
}

/**
 * Muxes video with TTS audio + optional background sound.
 * TTS at 100% volume, background sound at 30% via amix.
 */
export async function muxVideoWithSound(
	videoPath: string,
	ttsPath: string,
	soundPath: string,
	outputPath: string,
): Promise<void> {
	await execFileAsync(
		ffmpegBin(),
		[
			"-y",
			"-i",
			videoPath,
			"-i",
			ttsPath,
			"-i",
			soundPath,
			"-filter_complex",
			"[1:a]volume=1.0[tts];[2:a]volume=0.3[sfx];[tts][sfx]amix=inputs=2:duration=first:dropout_transition=0[aout]",
			"-map",
			"0:v:0",
			"-map",
			"[aout]",
			"-c:v",
			"copy",
			"-c:a",
			"aac",
			"-b:a",
			"192k",
			"-shortest",
			"-movflags",
			"+faststart",
			outputPath,
		],
		FFMPEG_OPTS,
	)
}
