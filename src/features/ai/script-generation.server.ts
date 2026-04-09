import "@tanstack/react-start/server-only";

import { pipelineModelContextBlock } from "./config/model-routing";
import { ScriptGenerationFailedError } from "./errors";
import type { ChannelCreativeBrief } from "./prompts/creative-brief.types";
import { isShortFormTargetSeconds } from "./prompts/video-format-surface";
import {
	generateTextGemini,
	isGeminiConfigured,
} from "./providers/gemini-text.server";
import {
	generateTextOpenRouter,
	isOpenRouterConfigured,
} from "./providers/openrouter-text.server";
import { generateTextPollinationsOpenAi } from "./providers/pollinations-text.server";

export type ScriptGenerationContext = ChannelCreativeBrief & { idea: string };

export type ScriptGenerationMode = "openrouter" | "gemini" | "pollinations";

function shortFormSystemPrompt(): string {
	return [
		"You are an elite **short-form** video strategist and scriptwriter. Your job is to produce scripts that feel native to **short-form, mobile-first feeds** (tight pacing, portrait-optimized), maximize watch-time and replays, and drive engagement for the creator's **connected publishing destination** — not generic internet content.",
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
		'- No fabricated statistics, fake studies, or misleading claims unless the brief explicitly requires them and they are clearly framed.',
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

function longFormSystemPrompt(): string {
	return [
		"You are an elite **long-form** video scriptwriter. Your job is to produce scripts that feel native to **in-depth video content** (tutorials, explainers, essays, storytelling) — clear structure, sustained value, and a strong payoff — for the creator's **connected publishing destination**, not generic internet content.",
		"## Niche and audience",
		"- Treat the niche as law. Every section must sound like it was written **for that audience only** — vocabulary, examples, and stakes belong to that niche.",
		"## Structure and pacing (long-form)",
		"- **Opening:** a compelling hook in the first moments — problem, promise, or question — without padding.",
		"- **Body:** logical flow (setup → insight → proof or demonstration → implications). Allow room for nuance; avoid repeating the hook.",
		"- **Depth:** match the target duration with substantive beats — not filler lists. Prefer one clear arc over scattered hot takes.",
		"- **Closing:** recap the takeaway, reinforce the niche promise, and one clear CTA (subscribe, comment, next step).",
		"## Tone and brand",
		"- Honor the requested tone (dark / educational / fun) consistently.",
		"- Suggest **b-roll or visual beat notes** in italics where helpful (optional), not every line.",
		"## Quality bar",
		"- No fabricated statistics or fake studies unless clearly framed as hypothetical.",
		"- No meta commentary about the AI. Output only the script artifact.",
		"## Output format (markdown)",
		"Use exactly these sections with clear headers:",
		"- **Hook** — opening spoken lines + optional visual note.",
		"- **Sections** — numbered sections with rough timestamps if helpful (e.g. 0:00–1:00, 1:00–4:00).",
		"- **Key phrases** — a few memorable lines or chapter titles suitable for description or chapters.",
		"- **Outro / CTA** — strong close tied to the niche and destination.",
		pipelineModelContextBlock(),
	].join("\n\n");
}

function systemPromptForBrief(ctx: ScriptGenerationContext): string {
	const t = ctx.targetSeconds ?? 60;
	return isShortFormTargetSeconds(t)
		? shortFormSystemPrompt()
		: longFormSystemPrompt();
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
		const t = ctx.targetSeconds ?? 60;
		const hint = isShortFormTargetSeconds(t)
			? "optimize hook length, pacing, and CTA for short-form."
			: "optimize structure, depth, and payoff for long-form.";
		lines.push(
			`- **Publishing surface:** ${ctx.publishingSurfaceLabel} — ${hint}`,
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

	// 1. OpenRouter (primary): free frontier models via OPENROUTER_API_KEYS.
	if (await isOpenRouterConfigured()) {
		try {
			const text = await generateTextOpenRouter({ system, user });
			return { text, mode: "openrouter" };
		} catch (e) {
			attempts.push(`openrouter:${e instanceof Error ? e.message : String(e)}`);
		}
	}

	// 2. Gemini (secondary): free tier (1500 req/day) via GEMINI_API_KEYS.
	if (await isGeminiConfigured()) {
		try {
			const text = await generateTextGemini({ system, user });
			return { text, mode: "gemini" };
		} catch (e) {
			attempts.push(`gemini:${e instanceof Error ? e.message : String(e)}`);
		}
	}

	// 3. Pollinations (last resort): no key required.
	try {
		const text = await generateTextPollinationsOpenAi({ system, user });
		return { text, mode: "pollinations" };
	} catch (e) {
		attempts.push(`pollinations:${e instanceof Error ? e.message : String(e)}`);
	}

	throw new ScriptGenerationFailedError(
		`Script generation failed after ${attempts.length} attempt(s). Check OPENROUTER_API_KEYS, GEMINI_API_KEYS, and provider quotas.`,
		attempts,
	);
}

/**
 * Script generation: **Gemini 2.0 Flash** (primary) → **Pollinations** (fallback).
 * Prompts are tuned for niche fit, retention, and engagement on the connected destination.
 */
export async function generateVideoScript(
	ctx: ScriptGenerationContext,
): Promise<{ text: string; mode: ScriptGenerationMode }> {
	const system = systemPromptForBrief(ctx);
	const user = userPrompt(ctx);
	return runProviders(system, user);
}
