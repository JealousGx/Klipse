import type { ProcessorJobSpec } from "@klipse/video-assembly-shared";
import { reportComplete } from "../utils/callbacks";
import { logEvent, logTiming, withTiming } from "../utils/logger";
import { cleanupFiles, tmpPath } from "../utils/temp-file";
import { runAssembleStage } from "./stages/assemble";
import { runPrepareStage } from "./stages/prepare";
import { runScriptStage } from "./stages/script";

function makeTmpDir(jobId: string) {
	return { path: (suffix: string) => tmpPath(`${jobId}-${suffix}`) };
}

/** Rethrows any error with the pipeline stage name prepended to the message. */
function rethrowWithStage(stage: string): (e: unknown) => never {
	return (e: unknown): never => {
		const base = e instanceof Error ? e.message : String(e);
		const err = new Error(`[${stage}] ${base}`);
		if (e instanceof Error) err.stack = e.stack;
		throw err;
	};
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
	const { jobId, channelId } = spec;
	const tmpDir = makeTmpDir(jobId);
	const cleanup: string[] = [];
	const ctx = { jobId, channelId };
	const jobStart = Date.now();

	logEvent("executor", "job.start", ctx);

	try {
		// Stage 1: Script generation.
		const { scriptMarkdown, ttsText } = await withTiming(
			"executor",
			"stage.script",
			() => runScriptStage(spec).catch(rethrowWithStage("script")),
			ctx,
		);

		// Stage 2: TTS + images + sound generation → R2 upload.
		const assets = await withTiming(
			"executor",
			"stage.prepare",
			() =>
				runPrepareStage(spec, scriptMarkdown, ttsText, tmpDir).catch(
					rethrowWithStage("prepare"),
				),
			ctx,
		);
		cleanup.push(assets.ttsAudioPath, ...assets.imagePaths);
		if (assets.soundAudioPath) cleanup.push(assets.soundAudioPath);

		// Stage 3: FFmpeg encode → watermark → R2 upload.
		await withTiming(
			"executor",
			"stage.assemble",
			() =>
				runAssembleStage(spec, assets, tmpDir, cleanup).catch(
					rethrowWithStage("assemble"),
				),
			ctx,
		);

		logTiming("executor", "job.done", Date.now() - jobStart, {
			...ctx,
			ok: true,
		});
		await reportComplete(spec, "completed", undefined, scriptMarkdown);
	} catch (e) {
		const msg = formatError(e);
		logTiming("executor", "job.failed", Date.now() - jobStart, {
			...ctx,
			ok: false,
			error: msg.slice(0, 200),
		});
		console.error(`[executor] job ${jobId} failed:`, e);
		try {
			await reportComplete(spec, "failed", msg);
		} catch (notifyErr) {
			console.error(
				`[executor] CRITICAL: complete callback failed for job ${jobId}`,
				notifyErr,
			);
		}
	} finally {
		await cleanupFiles(cleanup);
	}
}
