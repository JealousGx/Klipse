import { writeFile } from "node:fs/promises"

import type { ProcessorJobSpec } from "@klipse/video-assembly-shared"

import { generateImage } from "../../providers/image-gen"
import { generateSound } from "../../providers/sound-gen"
import { synthesizeSpeech } from "../../providers/tts-gen"
import { reportProgress } from "../../utils/callbacks"
import { logger } from "../../utils/logger"
import { cleanupFiles } from "../../utils/temp-file"

export type PreparedAssets = {
	ttsAudioPath: string
	imagePaths: string[]
	soundAudioPath: string | null
}

/**
 * Stage 2: Generate TTS audio, images, and optional sound; write to local tmpDir only.
 * Image prompts are passed in directly from the script stage (pre-extracted).
 * Images are generated sequentially to avoid Replicate burst=1 rate limit.
 * TTS runs concurrently with image generation.
 */
export async function runPrepareStage(
	spec: ProcessorJobSpec,
	imagePrompts: string[],
	ttsText: string,
	tmpDir: { path: (suffix: string) => string },
): Promise<PreparedAssets> {
	const stageStart = Date.now()
	logger.info("prepare_stage_start", { jobId: spec.jobId })

	// Track every file written so we can clean up on partial failure.
	const localCleanup: string[] = []

	try {
		await reportProgress(spec, "prepare", 5)

		// TTS runs concurrently with image generation.
		const ttsPromise = synthesizeSpeech(spec, ttsText)

		// Images generated sequentially to avoid burst=1 rate limit on Replicate.
		const imagePaths: string[] = []
		for (let i = 0; i < imagePrompts.length; i++) {
			const buf = await generateImage(spec, imagePrompts[i] ?? "")
			const p = tmpDir.path(`img-${i}.webp`)
			await writeFile(p, Buffer.from(buf))
			localCleanup.push(p) // track immediately — before next await that could throw
			imagePaths.push(p)
			await reportProgress(spec, "prepare", 20 + i * 20)
		}

		const ttsBuf = await ttsPromise
		const ttsAudioPath = tmpDir.path("tts.mp3")
		await writeFile(ttsAudioPath, Buffer.from(ttsBuf))
		localCleanup.push(ttsAudioPath)
		await reportProgress(spec, "prepare", 85)

		let soundAudioPath: string | null = null
		const soundBuf = await generateSound(spec)
		if (soundBuf) {
			soundAudioPath = tmpDir.path("sound.mp3")
			await writeFile(soundAudioPath, Buffer.from(soundBuf))
			localCleanup.push(soundAudioPath)
		}

		await reportProgress(spec, "prepare", 100)
		logger.info("prepare_stage_complete", {
			jobId: spec.jobId,
			durationMs: Date.now() - stageStart,
		})
		return { ttsAudioPath, imagePaths, soundAudioPath }
	} catch (e) {
		// Clean up any files written before the failure — caller won't see them.
		await cleanupFiles(localCleanup)
		logger.error("prepare_stage_error", {
			jobId: spec.jobId,
			durationMs: Date.now() - stageStart,
			error: e instanceof Error ? e.message : String(e),
		})
		throw e
	}
}
