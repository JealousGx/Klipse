import type { ProcessorJobSpec } from "@klipse/video-assembly-shared";

import { generateScript } from "../../providers/script-gen";
import { reportProgress } from "../../utils/callbacks";

// Extracts only spoken voiceover text from AI-generated script markdown.
function sanitizeForTts(raw: string): string {
	// Cut off at the first metadata/non-speech section marker.
	// These sections (Visual Scenes, Key Phrases, Style Notes, Why This Works, etc.)
	// always appear after the spoken content and should never reach TTS.
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

	return (
		body
			// Strip stage direction lines: *Visual:*, *Caption:*, *Sound:*, Visuals:
			.replace(/^[^\n]*(Visual|Caption|Sound)\s*:\*?[^\n]*/gim, "")
			// Strip voiceover label lines: *Voiceover (urgent):*
			.replace(/^[^\n]*\*{0,2}Voiceover[^:\n]*:[^\n]*/gim, "")
			// Strip section header lines: **Hook**, **Beat N**, **Outro**, **CTA**, **Script:**
			.replace(
				/^[^\n]*\*{0,2}(Hook|Beat\s*\d*|Outro|CTA|Script\s*:)[^\n]*/gim,
				"",
			)
			// Strip standalone metadata lines: **Tone:**, **CTA:**
			.replace(/^[^\n]*\*{0,2}(Tone|CTA)\s*:[^\n]*/gim, "")
			// Strip --- separators
			.replace(/^\s*---+\s*$/gm, "")
			// Strip markdown headings
			.replace(/^#{1,6}\s+.*/gm, "")
			// Unwrap bold+italic → text
			.replace(/\*{3}([^*\n]+)\*{3}/g, "$1")
			// Unwrap bold → text
			.replace(/\*\*([^*\n]+)\*\*/g, "$1")
			// Unwrap italic → text
			.replace(/\*([^*\n]+)\*/g, "$1")
			// Strip orphan asterisks
			.replace(/\*+/g, "")
			// Strip bullet/numbered list markers
			.replace(/^[-*]\s+/gm, "")
			.replace(/^\d+\.\s+/gm, "")
			// Strip parentheticals: (0–3s), (urgent, low tone), (on-screen captions)
			.replace(/\([^)]{0,80}\)/g, "")
			// Strip emoji
			.replace(
				/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,
				"",
			)
			// Strip smart/curly quotes
			.replace(/[""]/g, "")
			// Collapse whitespace
			.replace(/\n{3,}/g, "\n\n")
			.replace(/\s+/g, " ")
			.trim()
	);
}

function truncateToWords(text: string, maxWords: number): string {
	const words = text.split(/\s+/);
	if (words.length <= maxWords) return text;
	return `${words.slice(0, maxWords).join(" ")}…`;
}

export type ScriptResult = {
	scriptMarkdown: string;
	ttsText: string;
};

/**
 * Stage 1: Generate video script via OpenRouter.
 * Returns both the raw markdown (for image prompts) and TTS-ready plain text.
 */
export async function runScriptStage(
	spec: ProcessorJobSpec,
): Promise<ScriptResult> {
	await reportProgress(spec, "script", 10);

	const scriptMarkdown = await generateScript(spec);
	await reportProgress(spec, "script", 90);

	// Derive TTS text: strip markdown, truncate to word count for target duration.
	// ~140 words/min, conservative estimate.
	const maxWords = Math.ceil((spec.targetDuration / 60) * 140);
	const ttsText = truncateToWords(sanitizeForTts(scriptMarkdown), maxWords);

	await reportProgress(spec, "script", 100);
	return { scriptMarkdown, ttsText };
}
