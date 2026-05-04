import "@tanstack/react-start/server-only";

import { pipelineModelContextBlock } from "./config/model-routing";
import type { ChannelCreativeBrief } from "./prompts/creative-brief.types";
import { isShortFormTargetSeconds } from "./prompts/video-format-surface";

export type ScriptGenerationContext = ChannelCreativeBrief & { idea: string };
export type ScriptGenerationMode = "openrouter";

// ---------------------------------------------------------------------------
// System prompts
// ---------------------------------------------------------------------------

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
		"- No fabricated statistics, fake studies, or misleading claims unless the brief explicitly requires them and they are clearly framed.",
		'- No meta commentary about the AI, the prompt, or "as an AI".',
		"## Output format — JSON only (NO ARRAY OR IN ARRAY FORM)",
		'Output a single JSON object with exactly five keys. No prose, no markdown, no code fences, no array or in array form at all — raw JSON only:\n{"voiceover":"<all spoken lines — hook, beats, CTA — plain sentences, no stage directions, no markdown, no emoji, ready for text-to-speech>","imagePrompts":["<hook/opening beat>","<middle beat>","<closing beat>"],"title":"<60–100 char video title — specific, search-optimized, compelling, no clickbait>","description":"<2–3 sentence caption — punchy and engaging, platform-agnostic, works as YouTube description, TikTok caption, and Instagram caption equally>","tags":["<tag1>","<tag2>","... minimum 100 lowercase tags, no # prefix, niche-specific>"]}',
		'imagePrompts rules: exactly 3 strings (hook, mid, close). Each: niche-specific Subject + niche-fitting Environment + mood-matched Lighting/color + Art style. 2–4 rich sentences. Example (horror): "A decaying Victorian mansion at midnight shrouded in fog, single candle flickering in a broken window, cold blue moonlight, dead trees silhouetted, gothic horror painting style, highly detailed, ominous." Example (finance): "Extreme close-up of US hundred dollar bills fanned out on black surface, dramatic side lighting casting deep shadows, shallow depth of field, hyper-realistic studio photography, rich green and gold tones."',
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
		"## Quality bar",
		"- No fabricated statistics or fake studies unless clearly framed as hypothetical.",
		"- No meta commentary about the AI. Output only the script artifact.",
		"## Output format — JSON only (NO ARRAY OR IN ARRAY FORM)",
		'Output a single JSON object with exactly five keys. No prose, no markdown, no code fences, no array or in array form at all — raw JSON only:\n{"voiceover":"<all spoken lines — hook, sections, CTA — plain sentences, no stage directions, no markdown, no emoji, ready for text-to-speech>","imagePrompts":["<opening section>","<body/middle section>","<closing section>"],"title":"<60–100 char video title — specific, search-optimized, compelling, no clickbait>","description":"<2–3 sentence caption — punchy and engaging, platform-agnostic, works as YouTube description, TikTok caption, and Instagram caption equally>","tags":["<tag1>","<tag2>","... minimum 100 lowercase tags, no # prefix, niche-specific>"]}',
		'imagePrompts rules: exactly 3 strings (opening, body, close). Each: niche-specific Subject + niche-fitting Environment + mood-matched Lighting/color + Art style. 2–4 rich sentences. Example (history): "A vast Roman colosseum at golden hour, thousands of spectators in ancient robes, gladiators clashing in the dusty arena below, warm amber sunlight casting long shadows, epic cinematic photography, ultra-detailed, sweeping wide angle." Example (tech): "Engineer\'s hands holding a cracked smartphone revealing glowing circuit components inside, dark studio background with dramatic rim lighting, macro photography, cool blue and white tones, hyper-realistic, shallow depth of field."',
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
		`- **Target spoken length:** ~${ctx.targetSeconds ?? 30} seconds total (voiceover must fit in this duration exactly — keep it concise).`,
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

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the pre-built system and user prompts for a given context.
 * Used by `build-processor-job-spec.server.ts` to include prompts in the ProcessorJobSpec
 * so the external processor doesn't need to replicate prompt logic.
 */
export function buildScriptPrompts(ctx: ScriptGenerationContext): {
	system: string;
	user: string;
} {
	return { system: systemPromptForBrief(ctx), user: userPrompt(ctx) };
}
