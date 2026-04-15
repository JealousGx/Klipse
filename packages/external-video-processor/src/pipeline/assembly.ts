import { readFile, writeFile } from "node:fs/promises";
import type { VideoProcessorHandoffPayload } from "@klipse/video-assembly-shared";
import { concatSegments } from "../ffmpeg/concat";
import { muxVideoAudio, muxVideoWithSound } from "../ffmpeg/mux";
import { ffprobeDuration } from "../ffmpeg/probe";
import { encodeImageSegment } from "../ffmpeg/segment";
import { uploadBufferToPresignedUrl } from "../utils/r2-upload";
import { withRetries } from "../utils/retry";
import { cleanupFiles, tmpPath } from "../utils/temp-file";
import { applyWatermark, applyWatermarkWithAudio } from "../watermark/index";

async function fetchToFile(
	url: string,
	filePath: string,
	label: string,
): Promise<void> {
	await withRetries(`fetch_${label}`, 4, async () => {
		const res = await fetch(url, { signal: AbortSignal.timeout(300_000) });
		if (!res.ok) throw new Error(`fetch_${label}_${res.status}`);
		await writeFile(filePath, Buffer.from(await res.arrayBuffer()));
	});
}

async function runRichPipeline(
	payload: VideoProcessorHandoffPayload,
	cleanup: string[],
): Promise<void> {
	const imageUrls = (payload.imageUrls ?? []).filter((u) =>
		/^https?:\/\//.test(u),
	);
	if (imageUrls.length === 0 || !payload.ttsAudioUrl)
		throw new Error("rich_pipeline_missing_assets");

	const tmpAud = tmpPath("aud.mp3");
	const tmpSnd = tmpPath("snd.mp3");
	cleanup.push(tmpAud);

	const imagePaths: string[] = [];
	for (let i = 0; i < imageUrls.length; i++) {
		const p = tmpPath(`img-${i}.bin`);
		imagePaths.push(p);
		cleanup.push(p);
		await fetchToFile(imageUrls[i] ?? "", p, `image_${i}`);
	}
	await fetchToFile(payload.ttsAudioUrl, tmpAud, "audio");

	const hasSoundTrack = Boolean(
		payload.soundAudioUrl && /^https?:\/\//.test(payload.soundAudioUrl),
	);
	if (hasSoundTrack) {
		cleanup.push(tmpSnd);
		await fetchToFile(payload.soundAudioUrl as string, tmpSnd, "sound");
	}

	const audioDuration = await withRetries("ffprobe", 3, () =>
		ffprobeDuration(tmpAud),
	);
	const segDur = audioDuration / imageUrls.length;

	const segPaths: string[] = [];
	for (let i = 0; i < imagePaths.length; i++) {
		const segPath = tmpPath(`seg-${i}.mp4`);
		segPaths.push(segPath);
		cleanup.push(segPath);
		await withRetries(`seg_${i}`, 3, () =>
			encodeImageSegment(
				imagePaths[i] ?? "",
				segDur,
				payload.aspectRatio ?? "16:9",
				segPath,
			),
		);
	}

	const concatList = tmpPath("concat.txt");
	const videoOnly = tmpPath("video-only.mp4");
	const muxed = tmpPath("muxed.mp4");
	cleanup.push(concatList, videoOnly, muxed);

	await withRetries("concat", 3, () =>
		concatSegments(segPaths, concatList, videoOnly),
	);

	if (hasSoundTrack) {
		await withRetries("mux_sound", 3, () =>
			muxVideoWithSound(videoOnly, tmpAud, tmpSnd, muxed),
		);
	} else {
		await withRetries("mux", 3, () => muxVideoAudio(videoOnly, tmpAud, muxed));
	}

	let finalPath = muxed;
	if (payload.freeTierWatermark) {
		const wmPath = tmpPath("wm.mp4");
		cleanup.push(wmPath);
		await withRetries("watermark", 3, () =>
			applyWatermarkWithAudio(muxed, wmPath, payload.watermarkLabel),
		);
		finalPath = wmPath;
	}

	const buf = await readFile(finalPath);
	await uploadBufferToPresignedUrl(
		payload.presignedPutUrl,
		buf,
		payload.contentType,
	);
}

async function runPlaceholderPipeline(
	payload: VideoProcessorHandoffPayload,
	cleanup: string[],
): Promise<void> {
	const { execFile } = await import("node:child_process");
	const { promisify } = await import("node:util");
	const execFileAsync = promisify(execFile);
	const { ffmpegBin } = await import("../ffmpeg/probe");

	const tmpRaw = tmpPath("raw.mp4");
	const tmpFinal = tmpPath("out.mp4");
	cleanup.push(tmpRaw, tmpFinal);

	const placeholderArgs = [
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
		tmpRaw,
	];
	await withRetries("ffmpeg_placeholder", 3, () =>
		execFileAsync(ffmpegBin(), placeholderArgs, {
			timeout: 120_000,
			maxBuffer: 10 * 1024 * 1024,
		}),
	);

	if (payload.freeTierWatermark) {
		await withRetries("watermark", 3, () =>
			applyWatermark(tmpRaw, tmpFinal, payload.watermarkLabel),
		);
	}

	const videoPath = payload.freeTierWatermark ? tmpFinal : tmpRaw;
	const buf = await readFile(videoPath);
	await uploadBufferToPresignedUrl(
		payload.presignedPutUrl,
		buf,
		payload.contentType,
	);
}

/** Routes assembly job to the correct pipeline (rich or placeholder). */
export async function runAssemblyJob(
	payload: VideoProcessorHandoffPayload,
): Promise<void> {
	const cleanup: string[] = [];
	try {
		const hasRich =
			payload.imageUrls?.length &&
			payload.ttsAudioUrl &&
			/^https?:\/\//.test(payload.ttsAudioUrl);
		if (hasRich) {
			await runRichPipeline(payload, cleanup);
		} else {
			await runPlaceholderPipeline(payload, cleanup);
		}
	} finally {
		await cleanupFiles(cleanup);
	}
}
