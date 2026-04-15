import type { ProcessorJobSpec } from "@klipse/video-assembly-shared";
import { writeFile } from "node:fs/promises";

import { generateImage } from "../../providers/image-gen";
import { generateSound } from "../../providers/sound-gen";
import { synthesizeSpeech } from "../../providers/tts-gen";
import { reportProgress } from "../../utils/callbacks";

const IMAGE_COUNT = 3;

/** Strips markdown syntax, leaving plain text. */
function stripMarkdown(s: string): string {
	return s
		.replace(/^#+\s*/, "") // headings
		.replace(/\*{1,3}([^*]*)\*{1,3}/g, "$1") // bold/italic
		.replace(/_{1,3}([^_]*)_{1,3}/g, "$1") // underscore bold/italic
		.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links
		.replace(/`[^`]*`/g, "") // inline code
		.replace(/[*_~`>#]/g, "") // stray symbols
		.replace(/\s+/g, " ")
		.trim();
}

/**
 * Primary: extracts the dedicated **Visual scenes** section (numbered list 1. 2. 3.)
 * that the script generation prompt explicitly produces.
 *
 * Fallback: heuristic scan of script body lines (filters out headings/metadata).
 */
function visualPromptsFromScript(markdown: string): string[] {
	// --- Primary: parse "Visual scenes" section ---
	const visualSectionMatch = markdown.match(
		/\*{0,2}Visual scenes?\*{0,2}[^\n]*\n([\s\S]*?)(?=\n\*{0,2}[A-Z]|\n#{1,3}|\s*$)/i,
	);
	if (visualSectionMatch) {
		const section = visualSectionMatch[1] ?? "";
		const items = section
			.split(/\n/)
			.map((l) => l.replace(/^\s*\d+[.)]\s*/, "").trim()) // strip "1. " or "1) "
			.map(stripMarkdown)
			.filter((s) => s.length > 15);
		if (items.length >= IMAGE_COUNT) {
			return items.slice(0, IMAGE_COUNT).map((s) => s.slice(0, 800));
		}
	}

	// --- Fallback: heuristic body-line scan ---
	const lines = markdown
		.split(/\n+/)
		.map(stripMarkdown)
		.filter((s) => {
			if (s.length < 30) return false;
			if (
				/^(Script for|short.?form|channel|section|part \d|scene \d|visual scenes?)/i.test(
					s,
				)
			)
				return false;
			if (/^\[.*\]$/.test(s)) return false;
			return true;
		});

	const out: string[] = [];
	for (const line of lines) {
		if (out.length >= IMAGE_COUNT) break;
		out.push(line.slice(0, 800));
	}
	while (out.length < IMAGE_COUNT) {
		out.push(out[0] ?? "cinematic imagery, dramatic lighting, high detail");
	}
	return out.slice(0, IMAGE_COUNT);
}

export type PreparedAssets = {
	ttsAudioPath: string;
	imagePaths: string[];
	soundAudioPath: string | null;
};

/**
 * Stage 2: Generate TTS audio, images, and optional sound; write to local tmpDir only.
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

	const prompts = visualPromptsFromScript(scriptMarkdown);

	// TTS runs concurrently with image generation.
	const ttsPromise = synthesizeSpeech(spec, ttsText);

	// Images generated sequentially to avoid burst=1 rate limit on Replicate.
	const imagePaths: string[] = [];
	for (let i = 0; i < prompts.length; i++) {
		const buf = await generateImage(spec, prompts[i] ?? "");
		const p = tmpDir.path(`img-${i}.webp`);
		await writeFile(p, Buffer.from(buf));
		imagePaths.push(p);
		await reportProgress(spec, "prepare", 20 + i * 20);
	}

	const ttsBuf = await ttsPromise;
	const ttsAudioPath = tmpDir.path("tts.mp3");
	await writeFile(ttsAudioPath, Buffer.from(ttsBuf));
	await reportProgress(spec, "prepare", 85);

	let soundAudioPath: string | null = null;
	const soundBuf = await generateSound(spec);
	if (soundBuf) {
		soundAudioPath = tmpDir.path("sound.mp3");
		await writeFile(soundAudioPath, Buffer.from(soundBuf));
	}

	await reportProgress(spec, "prepare", 100);
	return { ttsAudioPath, imagePaths, soundAudioPath };
}
