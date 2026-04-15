import type { ProcessorJobSpec } from "@klipse/video-assembly-shared";
import { reportComplete } from "../utils/callbacks";
import { cleanupFiles, tmpPath } from "../utils/temp-file";
import { runAssembleStage } from "./stages/assemble";
import { runPrepareStage } from "./stages/prepare";
import { runScriptStage } from "./stages/script";

function makeTmpDir(jobId: string) {
	return { path: (suffix: string) => tmpPath(`${jobId}-${suffix}`) };
}

function formatError(e: unknown): string {
	if (e instanceof Error) {
		const base = e.message.trim();
		return e.cause instanceof Error
			? `${base} | ${e.cause.message}`.slice(0, 4000)
			: base.slice(0, 4000);
	}
	return String(e).slice(0, 4000);
}

/**
 * Executes the full content pipeline for a ProcessorJobSpec:
 * script → prepare (TTS + images + sound) → assemble (FFmpeg) → R2 upload → callback.
 * Always calls the complete callback (success or failure) before returning.
 */
export async function executeJob(spec: ProcessorJobSpec): Promise<void> {
	const tmpDir = makeTmpDir(spec.jobId);
	const cleanup: string[] = [];

	try {
		// Stage 1: Script generation.
		const { scriptMarkdown, ttsText } = await runScriptStage(spec);

		// Stage 2: TTS + images + sound generation → R2 upload.
		const assets = await runPrepareStage(spec, scriptMarkdown, ttsText, tmpDir);
		cleanup.push(assets.ttsAudioPath, ...assets.imagePaths);
		if (assets.soundAudioPath) cleanup.push(assets.soundAudioPath);

		// Stage 3: FFmpeg encode → watermark → R2 upload.
		await runAssembleStage(spec, assets, tmpDir, cleanup);

		await reportComplete(spec, "completed");
	} catch (e) {
		const msg = formatError(e);
		console.error(`[executor] job ${spec.jobId} failed:`, e);
		try {
			await reportComplete(spec, "failed", msg);
		} catch (notifyErr) {
			console.error(
				`[executor] CRITICAL: complete callback failed for job ${spec.jobId}`,
				notifyErr,
			);
		}
	} finally {
		await cleanupFiles(cleanup);
	}
}
