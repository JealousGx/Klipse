import type { ProcessorJobSpec } from "@klipse/video-assembly-shared";

import { generateScript } from "../../providers/script-gen";
import { reportProgress } from "../../utils/callbacks";

const IMAGE_COUNT = 3;

// ---------------------------------------------------------------------------
// Fallback helpers (used only when model returns non-JSON)
// ---------------------------------------------------------------------------

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
 * Extracts image generation prompts from a non-JSON script response.
 *
 * Primary: [VISUAL_SCENES]...[/VISUAL_SCENES] tagged block.
 * Secondary: markdown "Visual scenes" section header.
 * Fallback: heuristic body-line scan.
 */
function visualPromptsFromScript(markdown: string): string[] {
	// --- Primary: extract from [VISUAL_SCENES] tags ---
	const tagged = markdown.match(
		/\[VISUAL_SCENES\]([\s\S]*?)\[\/VISUAL_SCENES\]/i,
	);
	if (tagged?.[1]) {
		const items = tagged[1]
			.split(/\n/)
			.map((l) => l.replace(/^\s*\d+[.)]\s*/, "").trim())
			.map(stripMarkdown)
			.filter((s) => s.length > 15);
		if (items.length >= IMAGE_COUNT) {
			return items.slice(0, IMAGE_COUNT).map((s) => s.slice(0, 800));
		}
	}

	// --- Secondary: parse markdown "Visual scenes" section ---
	const visualSectionMatch = markdown.match(
		/\*{0,2}Visual scenes?\*{0,2}[^\n]*\n([\s\S]*?)(?=\n\*{0,2}[A-Z]|\n#{1,3}|\s*$)/i,
	);
	if (visualSectionMatch) {
		const section = visualSectionMatch[1] ?? "";
		const items = section
			.split(/\n/)
			.map((l) => l.replace(/^\s*\d+[.)]\s*/, "").trim())
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

/**
 * Extracts only spoken voiceover text from a non-JSON script response.
 *
 * Primary: content between [VOICEOVER]...[/VOICEOVER] tags.
 * Fallback: metadata-section cutoff + line-level stripping.
 */
function sanitizeForTts(raw: string): string {
	const tagged = raw.match(/\[VOICEOVER\]([\s\S]*?)\[\/VOICEOVER\]/i);
	if (tagged?.[1]) {
		return tagged[1]
			.replace(/\*+/g, "")
			.replace(/[""]/g, '"')
			.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "")
			.replace(/\s+/g, " ")
			.trim();
	}

	const METADATA_SECTION = new RegExp(
		[
			/\*{0,2}Visual\s+[Ss]cenes?/,
			/\*{0,2}Key\s+Phrases?/,
			/\*{0,2}Style\s+Notes?/,
			/\*{0,2}Why\s+This\s+Works/,
			/\*{0,2}Niche\s+Alignment/,
		]
			.map((r) => r.source)
			.join("|"),
	);
	const cutIdx = raw.search(METADATA_SECTION);
	const body = cutIdx !== -1 ? raw.slice(0, cutIdx) : raw;

	return body
		.replace(/^[^\n]*(Visual|Caption|Sound)\s*:\*?[^\n]*/gim, "")
		.replace(/^[^\n]*\*{0,2}Voiceover[^:\n]*:[^\n]*/gim, "")
		.replace(
			/^[^\n]*\*{0,2}(Hook|Beat\s*\d*|Outro|CTA|Script\s*:)[^\n]*/gim,
			"",
		)
		.replace(/^[^\n]*\*{0,2}(Tone|CTA)\s*:[^\n]*/gim, "")
		.replace(/^\s*---+\s*$/gm, "")
		.replace(/^#{1,6}\s+.*/gm, "")
		.replace(/\*{3}([^*\n]+)\*{3}/g, "$1")
		.replace(/\*\*([^*\n]+)\*\*/g, "$1")
		.replace(/\*([^*\n]+)\*/g, "$1")
		.replace(/\*+/g, "")
		.replace(/^[-*]\s+/gm, "")
		.replace(/^\d+\.\s+/gm, "")
		.replace(/\([^)]{0,80}\)/g, "")
		.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "")
		.replace(/[""]/g, '"')
		.replace(/\n{3,}/g, "\n\n")
		.replace(/\s+/g, " ")
		.trim();
}

// ---------------------------------------------------------------------------
// JSON parsing (primary path)
// ---------------------------------------------------------------------------

type ScriptJson = {
	voiceover: string;
	imagePrompts: string[];
	title?: string;
	description?: string;
	tags?: string[];
};

function parseScriptJson(raw: string): ScriptJson | null {
	try {
		const parsed = JSON.parse(raw) as unknown;
		if (
			typeof parsed === "object" &&
			parsed !== null &&
			typeof (parsed as Record<string, unknown>).voiceover === "string" &&
			Array.isArray((parsed as Record<string, unknown>).imagePrompts)
		) {
			return parsed as ScriptJson;
		}
	} catch {
		// fall through to tag/regex path
	}
	return null;
}

function truncateToWords(text: string, maxWords: number): string {
	const words = text.split(/\s+/);
	if (words.length <= maxWords) return text;
	return `${words.slice(0, maxWords).join(" ")}…`;
}

export type ScriptResult = {
	scriptMarkdown: string;
	ttsText: string;
	imagePrompts: string[];
	title?: string;
	description?: string;
	tags?: string[];
};

/**
 * Stage 1: Generate video script via OpenRouter.
 * Returns the raw response (for DB), TTS-ready voiceover, and 3 image prompts.
 *
 * Primary path: model returns JSON { voiceover, imagePrompts[] } — no sanitization needed.
 * Fallback path: tag/regex extraction for models that ignore response_format.
 */
export async function runScriptStage(
	spec: ProcessorJobSpec,
): Promise<ScriptResult> {
	await reportProgress(spec, "script", 10);

	const raw = await generateScript(spec);
	await reportProgress(spec, "script", 90);

	// ~140 words/min, conservative estimate.
	const maxWords = Math.ceil((spec.targetDuration / 60) * 140);

	const parsed = parseScriptJson(raw);

	let ttsText: string;
	let imagePrompts: string[];
	let title: string | undefined;
	let description: string | undefined;
	let tags: string[] | undefined;

	if (parsed) {
		// Clean path: structured JSON from model.
		ttsText = truncateToWords(
			parsed.voiceover
				.replace(/[""]/g, '"')
				.replace(
					/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,
					"",
				)
				.replace(/\s+/g, " ")
				.trim(),
			maxWords,
		);
		imagePrompts = (parsed.imagePrompts as string[])
			.slice(0, IMAGE_COUNT)
			.map((s) => String(s).trim().slice(0, 800))
			.filter((s) => s.length > 0);
		while (imagePrompts.length < IMAGE_COUNT) {
			imagePrompts.push(
				imagePrompts[0] ?? "cinematic imagery, dramatic lighting, high detail",
			);
		}
		title = parsed.title?.trim().slice(0, 100) || undefined;
		description = parsed.description?.trim().slice(0, 2000) || undefined;
		tags = Array.isArray(parsed.tags)
			? (parsed.tags as unknown[])
					.map((t) => String(t).toLowerCase().trim())
					.filter((t) => t.length > 0)
					.slice(0, 10)
			: undefined;
	} else {
		// Fallback: tag/regex sanitization — title/description/tags unavailable.
		ttsText = truncateToWords(sanitizeForTts(raw), maxWords);
		imagePrompts = visualPromptsFromScript(raw);
	}

	await reportProgress(spec, "script", 100);
	return { scriptMarkdown: raw, ttsText, imagePrompts, title, description, tags };
}
