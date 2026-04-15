import "@tanstack/react-start/server-only";

import { pipelineModelContextBlock } from "./config/model-routing";
import { ScriptGenerationFailedError } from "./errors";
import type { ChannelCreativeBrief } from "./prompts/creative-brief.types";
import { isShortFormTargetSeconds } from "./prompts/video-format-surface";
import {
	generateTextOpenRouter,
	isOpenRouterConfigured,
} from "./providers/openrouter-text.server";

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
		'- No meta commentary about the AI, the prompt, or "as an AI". Output only the script artifact.',
		"## Output format (markdown)",
		"Use exactly these sections with clear headers:",
		"- **Hook** — spoken line(s) + optional note for on-screen text in italics if useful.",
		"- **Beats** — numbered beats with rough seconds in parentheses if helpful (e.g. 0–5s, 5–12s).",
		"- **Key phrases** — 2–3 short phrases optimized for on-screen captions (aligned with niche + caption style).",
		"- **Outro / CTA** — one strong closing line tied to the niche and the publishing destination.",
		"- **Visual scenes** — exactly 3 image prompts as a numbered list (1. 2. 3.). Each corresponds to a distinct beat in the video (hook, mid, close). These are fed directly into an image generation AI — never spoken aloud. Make each prompt specific and rich:",
		"  - **Subject**: the main visual element relevant to that beat's content (not generic)",
		"  - **Environment**: setting that fits the channel niche",
		"  - **Lighting + color**: mood-matched (e.g. cold blue moonlight, warm golden hour, harsh neon)",
		"  - **Art style**: photography or illustration style that fits the tone (e.g. cinematic film still, dark fantasy oil painting, hyper-realistic macro photo, flat design illustration)",
		"  - **Length**: 2–4 sentences or a dense comma-separated description. More detail = better images.",
		"  - Example (horror): `A decaying Victorian mansion at midnight shrouded in fog, single candle flickering in a broken window, cold blue moonlight, dead trees silhouetted against overcast sky, gothic horror painting style, highly detailed, ominous atmosphere.`",
		"  - Example (finance): `Extreme close-up of US hundred dollar bills fanned out on a black surface, dramatic side lighting casting deep shadows, shallow depth of field, hyper-realistic studio photography, rich green and gold tones.`",
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
		"- **Visual scenes** — exactly 3 image prompts as a numbered list (1. 2. 3.). Each corresponds to a key section of the video (opening, body, close). These are fed directly into an image generation AI — never spoken aloud. Make each prompt specific and rich:",
		"  - **Subject**: the main visual element relevant to that section's content (not generic)",
		"  - **Environment**: setting that fits the channel niche",
		"  - **Lighting + color**: mood-matched (e.g. warm amber, cool clinical white, moody chiaroscuro)",
		"  - **Art style**: photography or illustration style that fits the tone (e.g. documentary film still, editorial illustration, hyper-realistic photo, watercolor infographic style)",
		"  - **Length**: 2–4 sentences or a dense comma-separated description. More detail = better images.",
		"  - Example (history): `A vast Roman colosseum at golden hour, thousands of spectators in ancient robes, gladiators clashing in the dusty arena below, warm amber sunlight casting long shadows, epic cinematic photography, ultra-detailed, sweeping wide angle.`",
		"  - Example (tech): `Engineer's hands holding a cracked smartphone revealing glowing circuit components inside, dark studio background with dramatic rim lighting, macro photography, cool blue and white tones, hyper-realistic, shallow depth of field.`",
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

/**
 * Script generation via OpenRouter.
 * OpenRouter handles model fallbacks internally via the `models[]` array
 * (primary → OPENROUTER_SCRIPT_FALLBACK_MODELS) — no manual retry chain needed.
 */
export async function generateVideoScript(
	ctx: ScriptGenerationContext,
): Promise<{ text: string; mode: ScriptGenerationMode }> {
	const system = systemPromptForBrief(ctx);
	const user = userPrompt(ctx);

	if (!(await isOpenRouterConfigured())) {
		throw new ScriptGenerationFailedError(
			"Script generation failed: no OpenRouter API keys configured. Add keys via the admin panel.",
			["openrouter_not_configured"],
		);
	}

	const text = await generateTextOpenRouter({ system, user });
	return { text, mode: "openrouter" };
}
