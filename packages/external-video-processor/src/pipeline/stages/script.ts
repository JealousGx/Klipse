import type { ProcessorJobSpec } from "@klipse/video-assembly-shared";

import { generateScript } from "../../providers/script-gen";
import { reportProgress } from "../../utils/callbacks";

// Simple markdown stripping for TTS (avoids reading headers, bullets as speech)
function sanitizeForTts(raw: string): string {
	return raw
		.replace(/^#{1,6}\s+.*/gm, "")
		.replace(/\*\*([^*]+)\*\*/g, "$1")
		.replace(/\*([^*]+)\*/g, "$1")
		.replace(/^[-*]\s+/gm, "")
		.replace(/^\d+\.\s+/gm, "")
		.replace(/\([^)]{0,30}\)/g, "")
		.replace(/\n{3,}/g, "\n\n")
		.replace(/\s+/g, " ")
		.trim();
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
