import { readFile } from "node:fs/promises";
import type { ProcessorJobSpec } from "@klipse/video-assembly-shared";
import { concatSegments } from "../../ffmpeg/concat";
import { muxVideoAudio, muxVideoWithSound } from "../../ffmpeg/mux";
import { ffprobeDuration } from "../../ffmpeg/probe";
import { encodeImageSegment } from "../../ffmpeg/segment";
import { reportProgress } from "../../utils/callbacks";
import { uploadBufferToPresignedUrl } from "../../utils/r2-upload";
import { withRetries } from "../../utils/retry";
import { applyWatermarkWithAudio } from "../../watermark/index";
import type { PreparedAssets } from "./prepare";

/**
 * Stage 3: FFmpeg slideshow → concat → mux audio → optional watermark → R2 upload.
 * All intermediate files are tracked for cleanup by the caller.
 */
export async function runAssembleStage(
	spec: ProcessorJobSpec,
	assets: PreparedAssets,
	tmpDir: { path: (suffix: string) => string },
	cleanup: string[],
): Promise<void> {
	await reportProgress(spec, "assemble", 5);

	const audioDuration = await withRetries("ffprobe", 3, () =>
		ffprobeDuration(assets.ttsAudioPath),
	);
	const segmentDur = audioDuration / assets.imagePaths.length;

	// Encode each image as a video segment.
	const segPaths: string[] = [];
	for (let i = 0; i < assets.imagePaths.length; i++) {
		const segPath = tmpDir.path(`seg-${i}.mp4`);
		await withRetries(`encode_seg_${i}`, 3, () =>
			encodeImageSegment(
				assets.imagePaths[i] ?? "",
				segmentDur,
				spec.aspectRatio,
				segPath,
				i,
			),
		);
		segPaths.push(segPath);
		cleanup.push(segPath);
		await reportProgress(spec, "assemble", 10 + i * 15);
	}

	// Concat segments → silent video.
	const concatListPath = tmpDir.path("concat.txt");
	const videoOnlyPath = tmpDir.path("video-only.mp4");
	cleanup.push(concatListPath, videoOnlyPath);
	await withRetries("ffmpeg_concat", 3, () =>
		concatSegments(segPaths, concatListPath, videoOnlyPath),
	);
	await reportProgress(spec, "assemble", 60);

	// Mux with TTS audio (+ optional background sound).
	const muxedPath = tmpDir.path("muxed.mp4");
	cleanup.push(muxedPath);
	if (assets.soundAudioPath) {
		await withRetries("ffmpeg_mux_sound", 3, () =>
			muxVideoWithSound(
				videoOnlyPath,
				assets.ttsAudioPath,
				assets.soundAudioPath as string,
				muxedPath,
			),
		);
	} else {
		await withRetries("ffmpeg_mux", 3, () =>
			muxVideoAudio(videoOnlyPath, assets.ttsAudioPath, muxedPath),
		);
	}
	await reportProgress(spec, "assemble", 80);

	// Apply watermark if free tier.
	let finalPath = muxedPath;
	if (spec.freeTierWatermark) {
		const wmPath = tmpDir.path("watermarked.mp4");
		cleanup.push(wmPath);
		await withRetries("watermark", 3, () =>
			applyWatermarkWithAudio(muxedPath, wmPath, spec.watermarkLabel),
		);
		finalPath = wmPath;
	}
	await reportProgress(spec, "assemble", 90);

	// Upload final video to R2 via presigned PUT URL.
	const buf = await readFile(finalPath);
	await uploadBufferToPresignedUrl(
		spec.presignedUrls.outputVideo,
		buf,
		"video/mp4",
	);
	await reportProgress(spec, "assemble", 100);
}
