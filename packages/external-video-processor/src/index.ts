import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { serve } from "@hono/node-server";
import type { VideoProcessorHandoffPayload } from "@klipse/video-assembly-shared";
import { Hono } from "hono";

const execFileAsync = promisify(execFile);

const FFMPEG_ATTEMPTS = 3;
const R2_PUT_ATTEMPTS = 4;
const WEBHOOK_ATTEMPTS = 6;
/** Extra attempts when notifying `status: "failed"` so the app can clear the job even if the first bursts fail. */
const WEBHOOK_FAILURE_ATTEMPTS = 10;
const RETRY_BASE_MS = 500;

function ffmpegBinary(): string {
	return process.env.FFMPEG_PATH?.trim() || "ffmpeg";
}

function ffprobeBinary(): string {
	return process.env.FFPROBE_PATH?.trim() || "ffprobe";
}

async function ffprobeDurationSeconds(mediaPath: string): Promise<number> {
	const { stdout } = await execFileAsync(
		ffprobeBinary(),
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
	if (!Number.isFinite(v) || v <= 0) {
		throw new Error("ffprobe_invalid_duration");
	}
	return v;
}

/** Placeholder encode for integration — real product replaces with pipeline output. */
function placeholderEncodeArgs(outputPath: string): string[] {
	return [
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
		outputPath,
	];
}

function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}

async function withRetries<T>(
	label: string,
	attempts: number,
	fn: (attempt: number) => Promise<T>,
): Promise<T> {
	let last: unknown;
	for (let attempt = 1; attempt <= attempts; attempt++) {
		try {
			return await fn(attempt);
		} catch (e) {
			last = e;
			if (attempt === attempts) {
				console.warn(
					`[external-video-processor] ${label} attempt ${attempt}/${attempts} failed (final)`,
					e,
				);
				break;
			}
			const delay = RETRY_BASE_MS * 2 ** (attempt - 1);
			console.warn(
				`[external-video-processor] ${label} attempt ${attempt}/${attempts} failed; retry in ${delay}ms`,
				e,
			);
			await sleep(delay);
		}
	}
	throw last instanceof Error
		? last
		: new Error(`${label}_failed:${String(last)}`);
}

function formatErrorForWebhook(e: unknown): string {
	if (e instanceof Error) {
		const base = e.message.trim();
		if (e.cause instanceof Error) {
			return `${base} | ${e.cause.message}`.slice(0, 4000);
		}
		return base.slice(0, 4000);
	}
	return String(e).slice(0, 4000);
}

function optionalHttpUrlList(x: unknown): boolean {
	if (x === undefined) {
		return true;
	}
	return (
		Array.isArray(x) &&
		x.every((u) => typeof u === "string" && /^https?:\/\//.test(u))
	);
}

function isHandoffPayload(x: unknown): x is VideoProcessorHandoffPayload {
	if (!x || typeof x !== "object") {
		return false;
	}
	const o = x as Record<string, unknown>;
	const label = o.watermarkLabel;
	if (
		typeof o.jobId !== "string" ||
		o.jobId.length === 0 ||
		typeof o.userId !== "string" ||
		o.userId.length === 0 ||
		typeof o.presignedPutUrl !== "string" ||
		!o.presignedPutUrl.startsWith("http") ||
		typeof o.contentType !== "string" ||
		typeof o.completeWebhookUrl !== "string" ||
		!o.completeWebhookUrl.startsWith("http") ||
		typeof o.freeTierWatermark !== "boolean" ||
		typeof label !== "string" ||
		label.length === 0 ||
		label.length > 128
	) {
		return false;
	}
	if (o.scriptText !== undefined && typeof o.scriptText !== "string") {
		return false;
	}
	if (!optionalHttpUrlList(o.imageUrls)) {
		return false;
	}
	if (
		o.ttsAudioUrl !== undefined &&
		(typeof o.ttsAudioUrl !== "string" || !/^https?:\/\//.test(o.ttsAudioUrl))
	) {
		return false;
	}
	return true;
}

async function notifyAppOnce(
	completeWebhookUrl: string,
	body: {
		jobId: string;
		userId: string;
		status: "completed" | "failed";
		error?: string;
	},
): Promise<void> {
	const secret = process.env.VIDEO_PROCESSOR_WEBHOOK_SECRET?.trim();
	if (!secret) {
		throw new Error("VIDEO_PROCESSOR_WEBHOOK_SECRET is not set");
	}
	const res = await fetch(completeWebhookUrl, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${secret}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(body),
		signal: AbortSignal.timeout(60_000),
	});
	if (!res.ok) {
		const t = await res.text().catch(() => "");
		throw new Error(`webhook_${res.status}:${t.slice(0, 300)}`);
	}
}

async function notifyAppWithRetries(
	completeWebhookUrl: string,
	body: {
		jobId: string;
		userId: string;
		status: "completed" | "failed";
		error?: string;
	},
	attempts: number,
): Promise<void> {
	await withRetries("notify_app", attempts, () =>
		notifyAppOnce(completeWebhookUrl, body),
	);
}

/** Jobs accepted (queue + in-flight); cleared when the pipeline fully finishes. */
const activeJobIds = new Set<string>();
/** Terminal: webhook delivered success/failure for this `jobId` (idempotent replays). */
const finishedJobIds = new Set<string>();

const queue: VideoProcessorHandoffPayload[] = [];
let pumpScheduled = false;

function finalizeJob(jobId: string): void {
	activeJobIds.delete(jobId);
	finishedJobIds.add(jobId);
}

/** Centered drawtext (FEATURE_DOC §10.3 free tier). Video-only; audio not in placeholder. */
async function applyCenterWatermarkToFile(
	inputPath: string,
	outputPath: string,
	label: string,
): Promise<void> {
	const labelPath = join(tmpdir(), `klipse-wm-lbl-${Date.now()}.txt`);
	await writeFile(labelPath, label, "utf8");
	const textPathForFilter = labelPath.replace(/\\/g, "/").replace(/:/g, "\\:");
	const vf = `drawtext=textfile=${textPathForFilter}:fontcolor=white@0.78:fontsize=36:box=1:boxcolor=black@0.38:boxborderw=8:x=(w-text_w)/2:y=(h-text_h)/2`;
	try {
		await execFileAsync(
			ffmpegBinary(),
			[
				"-y",
				"-i",
				inputPath,
				"-vf",
				vf,
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
			{
				timeout: 600_000,
				maxBuffer: 80 * 1024 * 1024,
			},
		);
	} finally {
		await unlink(labelPath).catch(() => {});
	}
}

/** Watermark video while preserving the first audio stream (content pipeline mux output). */
async function applyCenterWatermarkToVideoWithAudio(
	inputPath: string,
	outputPath: string,
	label: string,
): Promise<void> {
	const labelPath = join(tmpdir(), `klipse-wm-lbl-${Date.now()}.txt`);
	await writeFile(labelPath, label, "utf8");
	const textPathForFilter = labelPath.replace(/\\/g, "/").replace(/:/g, "\\:");
	const vf = `drawtext=textfile=${textPathForFilter}:fontcolor=white@0.78:fontsize=36:box=1:boxcolor=black@0.38:boxborderw=8:x=(w-text_w)/2:y=(h-text_h)/2`;
	try {
		await execFileAsync(
			ffmpegBinary(),
			[
				"-y",
				"-i",
				inputPath,
				"-vf",
				vf,
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
				"-map",
				"0:a:0",
				"-c:a",
				"aac",
				"-b:a",
				"192k",
				"-movflags",
				"+faststart",
				outputPath,
			],
			{
				timeout: 600_000,
				maxBuffer: 80 * 1024 * 1024,
			},
		);
	} finally {
		await unlink(labelPath).catch(() => {});
	}
}

/**
 * Content pipeline: all `imageUrls` as a slideshow (equal time per slide) + TTS audio.
 * Klipse does not store image bytes — processor fetches URLs.
 */
async function runRichStillImageWithAudioPipeline(
	payload: VideoProcessorHandoffPayload,
): Promise<void> {
	const imageUrls =
		payload.imageUrls?.filter(
			(u) => typeof u === "string" && /^https?:\/\//.test(u),
		) ?? [];
	const audUrl = payload.ttsAudioUrl;
	if (imageUrls.length === 0 || !audUrl) {
		throw new Error("rich_pipeline_missing_assets");
	}

	const tmpAud = join(tmpdir(), `klipse-aud-${randomUUID()}.mp3`);
	const tmpVid = join(tmpdir(), `klipse-rich-${payload.jobId}.mp4`);
	const tmpWm = join(tmpdir(), `klipse-rich-wm-${payload.jobId}.mp4`);
	const tmpVideoOnly = join(tmpdir(), `klipse-rich-vo-${payload.jobId}.mp4`);
	const concatListPath = join(tmpdir(), `klipse-concat-${payload.jobId}.txt`);
	const cleanup: string[] = [];

	try {
		const tmpImagePaths: string[] = [];
		for (let i = 0; i < imageUrls.length; i++) {
			const url = imageUrls[i];
			const imgPath = join(
				tmpdir(),
				`klipse-img-${payload.jobId}-${i}-${randomUUID()}.bin`,
			);
			tmpImagePaths.push(imgPath);
			cleanup.push(imgPath);
			await withRetries(`fetch_image_${i}`, R2_PUT_ATTEMPTS, async () => {
				const res = await fetch(url, { signal: AbortSignal.timeout(300_000) });
				if (!res.ok) {
					throw new Error(`image_fetch_${res.status}`);
				}
				await writeFile(imgPath, Buffer.from(await res.arrayBuffer()));
			});
		}

		await withRetries("fetch_audio", R2_PUT_ATTEMPTS, async () => {
			const res = await fetch(audUrl, { signal: AbortSignal.timeout(300_000) });
			if (!res.ok) {
				throw new Error(`audio_fetch_${res.status}`);
			}
			await writeFile(tmpAud, Buffer.from(await res.arrayBuffer()));
		});
		cleanup.push(tmpAud);

		const audioDuration = await withRetries("ffprobe_audio", FFMPEG_ATTEMPTS, () =>
			ffprobeDurationSeconds(tmpAud),
		);
		const n = imageUrls.length;
		const segmentDur = audioDuration / n;

		const segPaths: string[] = [];
		const vf =
			"scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,format=yuv420p";

		for (let i = 0; i < n; i++) {
			const segPath = join(tmpdir(), `klipse-seg-${payload.jobId}-${i}.mp4`);
			segPaths.push(segPath);
			cleanup.push(segPath);
			await withRetries(`ffmpeg_seg_${i}`, FFMPEG_ATTEMPTS, () =>
				execFileAsync(
					ffmpegBinary(),
					[
						"-y",
						"-loop",
						"1",
						"-i",
						tmpImagePaths[i],
						"-t",
						String(segmentDur),
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
						segPath,
					],
					{
						timeout: 600_000,
						maxBuffer: 80 * 1024 * 1024,
					},
				),
			);
		}

		const concatBody = segPaths
			.map((p) => `file '${p.replace(/'/g, "'\\''")}'`)
			.join("\n");
		await writeFile(concatListPath, concatBody, "utf8");
		cleanup.push(concatListPath);

		await withRetries("ffmpeg_concat", FFMPEG_ATTEMPTS, () =>
			execFileAsync(
				ffmpegBinary(),
				[
					"-y",
					"-f",
					"concat",
					"-safe",
					"0",
					"-i",
					concatListPath,
					"-c",
					"copy",
					tmpVideoOnly,
				],
				{
					timeout: 600_000,
					maxBuffer: 80 * 1024 * 1024,
				},
			),
		);
		cleanup.push(tmpVideoOnly);

		await withRetries("ffmpeg_mux", FFMPEG_ATTEMPTS, () =>
			execFileAsync(
				ffmpegBinary(),
				[
					"-y",
					"-i",
					tmpVideoOnly,
					"-i",
					tmpAud,
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
					tmpVid,
				],
				{
					timeout: 600_000,
					maxBuffer: 80 * 1024 * 1024,
				},
			),
		);
		cleanup.push(tmpVid);

		let videoPath = tmpVid;
		if (payload.freeTierWatermark) {
			await withRetries("watermark", FFMPEG_ATTEMPTS, () =>
				applyCenterWatermarkToVideoWithAudio(
					tmpVid,
					tmpWm,
					payload.watermarkLabel,
				),
			);
			videoPath = tmpWm;
			cleanup.push(tmpWm);
		}

		const buf = await readFile(videoPath);

		await withRetries("r2_put", R2_PUT_ATTEMPTS, async () => {
			const put = await fetch(payload.presignedPutUrl, {
				method: "PUT",
				headers: {
					"Content-Type": payload.contentType,
				},
				body: buf,
				signal: AbortSignal.timeout(120_000),
			});
			if (!put.ok) {
				const errText = await put.text().catch(() => "");
				throw new Error(`r2_put_${put.status}:${errText.slice(0, 500)}`);
			}
		});

		await notifyAppWithRetries(
			payload.completeWebhookUrl,
			{
				jobId: payload.jobId,
				userId: payload.userId,
				status: "completed",
			},
			WEBHOOK_ATTEMPTS,
		);
	} finally {
		for (const p of cleanup) {
			await unlink(p).catch(() => {});
		}
	}
}

async function runAssemblyPipeline(
	payload: VideoProcessorHandoffPayload,
): Promise<void> {
	const hasRich =
		payload.imageUrls &&
		payload.imageUrls.length > 0 &&
		payload.ttsAudioUrl &&
		/^https?:\/\//.test(payload.ttsAudioUrl);

	if (hasRich) {
		await runRichStillImageWithAudioPipeline(payload);
		return;
	}

	const tmpRaw = join(tmpdir(), `klipse-raw-${payload.jobId}.mp4`);
	const tmpFinal = join(tmpdir(), `klipse-out-${payload.jobId}.mp4`);
	try {
		await withRetries("ffmpeg", FFMPEG_ATTEMPTS, () =>
			execFileAsync(ffmpegBinary(), placeholderEncodeArgs(tmpRaw), {
				timeout: 120_000,
				maxBuffer: 10 * 1024 * 1024,
			}),
		);

		if (payload.freeTierWatermark) {
			await withRetries("watermark", FFMPEG_ATTEMPTS, () =>
				applyCenterWatermarkToFile(tmpRaw, tmpFinal, payload.watermarkLabel),
			);
		}

		const buf = await readFile(payload.freeTierWatermark ? tmpFinal : tmpRaw);

		await withRetries("r2_put", R2_PUT_ATTEMPTS, async () => {
			const put = await fetch(payload.presignedPutUrl, {
				method: "PUT",
				headers: {
					"Content-Type": payload.contentType,
				},
				body: buf,
				signal: AbortSignal.timeout(120_000),
			});
			if (!put.ok) {
				const errText = await put.text().catch(() => "");
				throw new Error(`r2_put_${put.status}:${errText.slice(0, 500)}`);
			}
		});

		await notifyAppWithRetries(
			payload.completeWebhookUrl,
			{
				jobId: payload.jobId,
				userId: payload.userId,
				status: "completed",
			},
			WEBHOOK_ATTEMPTS,
		);
	} catch (e) {
		const message = formatErrorForWebhook(e);
		console.warn(
			`[external-video-processor] job ${payload.jobId} pipeline error; sending failure webhook`,
			e,
		);
		try {
			await notifyAppWithRetries(
				payload.completeWebhookUrl,
				{
					jobId: payload.jobId,
					userId: payload.userId,
					status: "failed",
					error: message || "ffmpeg_or_upload_failed",
				},
				WEBHOOK_FAILURE_ATTEMPTS,
			);
			console.warn(
				`[external-video-processor] failure webhook accepted for job ${payload.jobId}`,
			);
		} catch (notifyErr) {
			console.error(
				`[external-video-processor] CRITICAL: failure webhook failed after ${WEBHOOK_FAILURE_ATTEMPTS} attempts; job ${payload.jobId} may stay processing until manual fix`,
				notifyErr,
			);
		}
	} finally {
		await unlink(tmpRaw).catch(() => {});
		await unlink(tmpFinal).catch(() => {});
	}
}

async function pumpQueue(): Promise<void> {
	while (queue.length > 0) {
		const payload = queue.shift();
		if (!payload) {
			break;
		}
		try {
			await runAssemblyPipeline(payload);
		} catch (e) {
			console.error("[external-video-processor] pipeline error", e);
		} finally {
			finalizeJob(payload.jobId);
		}
	}
}

function schedulePump(): void {
	if (pumpScheduled) {
		return;
	}
	pumpScheduled = true;
	void (async () => {
		try {
			await pumpQueue();
		} finally {
			pumpScheduled = false;
			if (queue.length > 0) {
				schedulePump();
			}
		}
	})();
}

const app = new Hono();

app.get("/health", (c) => c.text("ok"));

app.post("/v1/process", async (c) => {
	const expected = process.env.VIDEO_PROCESSOR_CLIENT_SECRET?.trim();
	if (!expected) {
		return c.json({ error: "server_misconfigured" }, 503);
	}
	const auth = c.req.header("authorization");
	if (auth !== `Bearer ${expected}`) {
		return c.json({ error: "unauthorized" }, 401);
	}

	let raw: unknown;
	try {
		raw = await c.req.json();
	} catch {
		return c.json({ error: "invalid_json" }, 400);
	}

	if (!isHandoffPayload(raw)) {
		return c.json({ error: "invalid_body" }, 400);
	}

	const jobId = raw.jobId;

	if (finishedJobIds.has(jobId)) {
		return c.json({ accepted: true as const, idempotent: true as const }, 202);
	}
	if (activeJobIds.has(jobId)) {
		return c.json({ accepted: true as const, idempotent: true as const }, 202);
	}

	activeJobIds.add(jobId);
	queue.push(raw);
	schedulePump();

	return c.json({ accepted: true as const }, 202);
});

const port = Number(process.env.PORT) || 8790;
serve({ fetch: app.fetch, port }, (info) => {
	console.log(`[external-video-processor] listening on port ${info.port}`);
});
