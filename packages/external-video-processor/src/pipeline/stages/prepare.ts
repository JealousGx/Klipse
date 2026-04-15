import { writeFile } from "node:fs/promises";
import type { ProcessorJobSpec } from "@klipse/video-assembly-shared";

import { generateImage } from "../../providers/image-gen";
import { generateSound } from "../../providers/sound-gen";
import { synthesizeSpeech } from "../../providers/tts-gen";
import { reportProgress } from "../../utils/callbacks";
import { uploadBufferToPresignedUrl } from "../../utils/r2-upload";

const IMAGE_COUNT = 3;

/** Extracts up to IMAGE_COUNT visual prompts from script markdown (paragraph lines). */
function visualPromptsFromScript(markdown: string): string[] {
	const lines = markdown
		.split(/\n+/)
		.map((s) => s.replace(/^#+\s*/, "").trim())
		.filter(Boolean);

	const out: string[] = [];
	for (const line of lines) {
		if (out.length >= IMAGE_COUNT) break;
		const chunk = line.slice(0, 400);
		if (chunk.length > 0) out.push(chunk);
	}
	while (out.length < IMAGE_COUNT) {
		out.push(out[0] ?? "cinematic imagery, soft lighting, high detail");
	}
	return out.slice(0, IMAGE_COUNT);
}

export type PreparedAssets = {
	ttsAudioPath: string;
	imagePaths: string[];
	soundAudioPath: string | null;
};

/**
 * Stage 2: Generate and upload TTS audio, images, and optional sound to R2.
 * Images are generated sequentially to avoid Replicate burst=1 rate limit.
 * TTS runs concurrently with image generation.
 */
export async function runPrepareStage(
	spec: ProcessorJobSpec,
	scriptMarkdown: string,
	ttsText: string,
	tmpDir: { path: (suffix: string) => string },
): Promise<PreparedAssets> {
	await reportProgress(spec, "prepare", 5);

	if (spec.presignedUrls.images.length < IMAGE_COUNT) {
		throw new Error(
			`prepare_missing_presigned_urls: expected ${IMAGE_COUNT} image URLs, got ${spec.presignedUrls.images.length}`,
		);
	}

	const prompts = visualPromptsFromScript(scriptMarkdown);

	// TTS runs concurrently with image generation.
	const ttsPromise = synthesizeSpeech(spec, ttsText);

	// Images generated sequentially to avoid burst=1 rate limit on Replicate.
	const imagePaths: string[] = [];
	for (let i = 0; i < prompts.length; i++) {
		const buf = await generateImage(spec, prompts[i] ?? "");
		const p = tmpDir.path(`img-${i}.webp`);
		await writeFile(p, Buffer.from(buf));
		await uploadBufferToPresignedUrl(
			spec.presignedUrls.images[i] as string,
			Buffer.from(buf),
			"image/webp",
		);
		imagePaths.push(p);
		await reportProgress(spec, "prepare", 20 + i * 20);
	}

	const ttsBuf = await ttsPromise;
	const ttsAudioPath = tmpDir.path("tts.mp3");
	await writeFile(ttsAudioPath, Buffer.from(ttsBuf));
	await uploadBufferToPresignedUrl(
		spec.presignedUrls.ttsAudio,
		Buffer.from(ttsBuf),
		"audio/mpeg",
	);
	await reportProgress(spec, "prepare", 85);

	let soundAudioPath: string | null = null;
	const soundBuf = await generateSound(spec);
	if (soundBuf && spec.presignedUrls.soundAudio) {
		soundAudioPath = tmpDir.path("sound.mp3");
		await writeFile(soundAudioPath, Buffer.from(soundBuf));
		await uploadBufferToPresignedUrl(
			spec.presignedUrls.soundAudio,
			Buffer.from(soundBuf),
			"audio/mpeg",
		);
	}

	await reportProgress(spec, "prepare", 100);
	return { ttsAudioPath, imagePaths, soundAudioPath };
}
