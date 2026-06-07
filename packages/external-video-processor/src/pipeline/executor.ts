import type { ProcessorJobSpec } from "@klipse/video-assembly-shared";
import { reportComplete } from "../utils/callbacks";
import { logEvent, logger, logTiming, withTiming } from "../utils/logger";
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
	logger.info("job_start", { jobId, channelId });

	try {
		// Stage 1: Script generation.
		const stageScriptStart = Date.now();
		const { scriptMarkdown, ttsText, imagePrompts, title, description, tags } =
			await withTiming(
				"executor",
				"stage.script",
				() => runScriptStage(spec).catch(rethrowWithStage("script")),
				ctx,
			);
		logger.info("stage_complete", {
			jobId,
			stage: "script",
			durationMs: Date.now() - stageScriptStart,
		});

		// Stage 2: TTS + images + sound generation.
		const stagePrepareStart = Date.now();
		const assets = await withTiming(
			"executor",
			"stage.prepare",
			() =>
				runPrepareStage(spec, imagePrompts, ttsText, tmpDir).catch(
					rethrowWithStage("prepare"),
				),
			ctx,
		);
		cleanup.push(assets.ttsAudioPath, ...assets.imagePaths);
		if (assets.soundAudioPath) cleanup.push(assets.soundAudioPath);
		logger.info("stage_complete", {
			jobId,
			stage: "prepare",
			durationMs: Date.now() - stagePrepareStart,
		});

		// Stage 3: FFmpeg encode → watermark → R2 upload.
		const stageAssembleStart = Date.now();
		const { durationSec } = await withTiming(
			"executor",
			"stage.assemble",
			() =>
				runAssembleStage(spec, assets, tmpDir, cleanup).catch(
					rethrowWithStage("assemble"),
				),
			ctx,
		);
		logger.info("stage_complete", {
			jobId,
			stage: "assemble",
			durationMs: Date.now() - stageAssembleStart,
		});

		logTiming("executor", "job.done", Date.now() - jobStart, {
			...ctx,
			ok: true,
		});
		logger.info("job_complete", { jobId, durationMs: Date.now() - jobStart });
		await reportComplete(
			spec,
			"completed",
			undefined,
			scriptMarkdown,
			title,
			description,
			tags,
			durationSec,
		).catch((e) => {
			const msg = e instanceof Error ? e.message : String(e);
			// 409 invalid_state = job already in a terminal state (e.g. re-dispatched while
			// this processor was running). Video encoded successfully — don't escalate to a
			// failure callback, which would incorrectly mark the job failed.
			if (msg.includes("callback_409")) {
				logger.warn("complete_callback_invalid_state", {
					jobId,
					error: msg,
				});
				return;
			}
			throw e;
		});
	} catch (e) {
		const msg = formatError(e);
		logTiming("executor", "job.failed", Date.now() - jobStart, {
			...ctx,
			ok: false,
			error: msg.slice(0, 200),
		});
		logger.error("job_error", {
			jobId,
			durationMs: Date.now() - jobStart,
			error: msg.slice(0, 200),
		});
		try {
			await reportComplete(spec, "failed", msg);
		} catch (notifyErr) {
			logger.error("job_complete_callback_failed", {
				jobId,
				error:
					notifyErr instanceof Error ? notifyErr.message : String(notifyErr),
			});
		}
	} finally {
		await cleanupFiles(cleanup);
	}
}
