import "@tanstack/react-start/server-only";

import { pipelineModelContextBlock } from "./config/model-routing";
import { ScriptGenerationFailedError } from "./errors";
import type { ChannelCreativeBrief } from "./prompts/creative-brief.types";
import {
	generateTextGemini,
	isGeminiConfigured,
} from "./providers/gemini-text.server";
import { generateTextPollinationsOpenAi } from "./providers/pollinations-text.server";

export type ScriptGenerationContext = ChannelCreativeBrief & { idea: string };

export type ScriptGenerationMode = "pollinations" | "gemini";

function baseSystemPrompt(): string {
	return [
		"You are an elite short-form video strategist and scriptwriter. Your job is to produce scripts that feel native to **vertical, mobile-first feeds** (full-screen portrait, tight pacing), maximize watch-time and replays, and drive engagement on the creator's **connected publishing destination** — not generic internet content.",
		"## Niche and audience",
		"- Treat the niche as law. Every line must sound like it was written **for that audience only** — vocabulary, references, pain points, and wins belong to that niche.",
		'- The viewer should feel: "this channel gets me." Never flatten the niche into vague advice.',
		"## Growth and retention (short-form)",
		'- **First 1–2 seconds:** a pattern-interrupt hook — curiosity, tension, or bold claim — no "Hey guys" or slow intros.',
		"- **Pacing:** tight sentences; one idea per beat; no filler. Match the target duration — every second should earn the next.",
		"- **Retention:** open loops, mini-payoffs, and a reason to watch to the end (reveal, list finale, punchline, or CTA payoff).",
		"- **Engagement:** naturally invite **comments, saves, shares, or follows** where appropriate (one clear CTA, not spammy).",
		"## Tone and brand",
		"- Honor the requested tone (dark / educational / fun) consistently.",
		"- If caption style is bold, suggest punchy on-screen phrases; if minimal, suggest fewer, sharper lines.",
		"## Quality bar",
		'- No fabricated statistics, fake studies, or "doctors hate this" tropes unless the brief explicitly requires them and they are clearly framed.',
		'- No meta commentary about the AI, the prompt, or "as an AI". Output only the script artifact.',
		"## Output format (markdown)",
		"Use exactly these sections with clear headers:",
		"- **Hook** — spoken line(s) + optional note for on-screen text in italics if useful.",
		"- **Beats** — numbered beats with rough seconds in parentheses if helpful (e.g. 0–5s, 5–12s).",
		"- **Key phrases** — 2–3 short phrases optimized for on-screen captions (aligned with niche + caption style).",
		"- **Outro / CTA** — one strong closing line tied to the niche and the publishing destination.",
		pipelineModelContextBlock(),
	].join("\n\n");
}

function userPrompt(ctx: ScriptGenerationContext): string {
	const lines: string[] = [
		"## Creator brief",
		`- **Channel / destination name:** ${ctx.channelName}`,
	];

	if (ctx.destinationDisplayName?.trim()) {
		lines.push(
			`- **Linked destination (when published):** ${ctx.destinationDisplayName.trim()}`,
		);
	}

	if (ctx.publishingSurfaceLabel) {
		lines.push(
			`- **Publishing surface:** ${ctx.publishingSurfaceLabel} — optimize hook length, pacing, and CTA for this format.`,
		);
	}

	lines.push(
		`- **Niche / positioning:** ${ctx.niche}`,
		`- **Tone:** ${ctx.tone}`,
		`- **Target spoken length:** ~${ctx.targetSeconds ?? 60} seconds total (voiceover must fit).`,
	);

	if (ctx.postingFrequency) {
		lines.push(
			`- **Posting cadence:** ${ctx.postingFrequency} — match energy (e.g. daily = tighter hooks; weekly = slightly more "event" feel).`,
		);
	}

	if (ctx.captionStyle) {
		lines.push(
			`- **On-screen caption style:** ${ctx.captionStyle} — reflect this in suggested key phrases.`,
		);
	}

	if (ctx.fontPairLabel?.trim()) {
		lines.push(
			`- **Brand typography hint (for captions):** ${ctx.fontPairLabel.trim()}`,
		);
	}

	lines.push("", "## Video idea to expand", ctx.idea.trim());

	return lines.join("\n");
}

async function runProviders(
	system: string,
	user: string,
): Promise<{ text: string; mode: ScriptGenerationMode }> {
	const attempts: string[] = [];

	try {
		const text = await generateTextPollinationsOpenAi({ system, user });
		return { text, mode: "pollinations" };
	} catch (e) {
		attempts.push(`pollinations:${e instanceof Error ? e.message : String(e)}`);
	}

	if (!(await isGeminiConfigured())) {
		throw new ScriptGenerationFailedError(
			"Script generation failed: Gemini is not configured (add `provider_api_keys` rows or set GEMINI_API_KEYS) and Pollinations failed.",
			attempts,
		);
	}

	try {
		const text = await generateTextGemini({ system, user });
		return { text, mode: "gemini" };
	} catch (e) {
		attempts.push(`gemini:${e instanceof Error ? e.message : String(e)}`);
	}

	throw new ScriptGenerationFailedError(
		"Script generation failed: Pollinations and Gemini both failed. Check credentials and quotas.",
		attempts,
	);
}

/**
 * Script: **Pollinations** (Claude/Mistral-class) → **Gemini 2.5 Flash** (multi-key).
 * Prompts are tuned for niche fit, retention, and engagement on the connected destination.
 */
export async function generateVideoScript(
	ctx: ScriptGenerationContext,
): Promise<{ text: string; mode: ScriptGenerationMode }> {
	const system = baseSystemPrompt();
	const user = userPrompt(ctx);
	return runProviders(system, user);
}
