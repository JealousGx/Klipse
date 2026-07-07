import "@tanstack/react-start/server-only"

import { pipelineModelContextBlock } from "./config/model-routing"
import type { ChannelCreativeBrief } from "./prompts/creative-brief.types"
import { isShortFormTargetSeconds } from "./prompts/video-format-surface"

export type ScriptGenerationContext = ChannelCreativeBrief & { idea: string }
export type ScriptGenerationMode = "openrouter"

/**
 * Each segment is generated as an independent model call, one call = NUM_FRAMES_PER_SEGMENT
 * (121) frames at FRAME_RATE (24fps) in processor/src/inference/generate.py — the real
 * official default for LTX-2.3's two-stage distilled pipeline (confirmed against
 * Lightricks/LTX-2@a2c3f24078eb918171967f74b6f66b756b29ee45, the exact commit their own
 * LTX-Desktop product pins), not an invented duration. 121/24 ≈ 5.04s carries the widest
 * safety margin against the VRAM ceiling of any duration we've actually tested — a single
 * un-segmented ~30s call reliably OOMs on a 96GB GPU (confirmed via real deploys).
 */
export const SEGMENT_DURATION_SECONDS = 121 / 24
// Rounded form for prompt text — the LLM only needs "~5s", not the exact fraction.
const SEGMENT_DURATION_LABEL = "5"

export function segmentCountForDuration(targetSeconds: number): number {
	return Math.max(1, Math.ceil(targetSeconds / SEGMENT_DURATION_SECONDS))
}

// ---------------------------------------------------------------------------
// System prompts
// ---------------------------------------------------------------------------

/**
 * LTX-2.3 prompting technique (per https://ltx.io/blog/ltx-2-3-prompt-guide), condensed into
 * instruction form for the script-gen LLM — now producing an ARRAY of segment prompts rather
 * than one prompt, since a single call covering the full target duration reliably runs out of
 * GPU memory (confirmed via real deploys). Each array entry is generated as its own independent
 * model call (~5s each), then the resulting clips are concatenated into one final video.
 * Continuity now comes from two things together: how consistently these prompts are written,
 * and real start-frame conditioning on the processor side (processor/src/inference/generate.py
 * anchors each segment after the first to the actual last frame of the one before it via
 * DistilledPipeline's `images` parameter) — visual appearance at the very start of each segment
 * has a real technical backstop now, but motion/velocity beyond that one frame and audio/
 * narration continuity do not, so the instructions below still matter.
 */
const LTX_PROMPT_TECHNIQUE_BLOCK = [
	"## How to write each entry in `video_prompts` (LTX-2.3 prompting technique)",
	"LTX-2.3 responds best to long, detailed, single prompts — not short fragments. It generates video AND audio (narration/dialogue, ambient sound, music) together from each prompt, so include everything in each entry: no separate script or voiceover text will be produced.",
	"Include, in flowing prose (not a bulleted list) — cinematography terms matching the genre (e.g. tracking shot, close-up, wide establishing shot); lighting, color palette, surface textures, and atmosphere to set mood; subject description (age, hairstyle, clothing, distinguishing features); emotion conveyed through physical cues (a trembling hand, a held breath) rather than abstract labels; camera movement described as how it moves and how the subject appears differently after that movement; and ambient sound, music, or speech/narration cues woven into the description.",
	"## Critical: each entry is generated independently — only the very first frame is anchored",
	"`video_prompts` is an array — each entry is sent to the video model as its OWN separate generation call. The very first frame of entry N is anchored to the real last frame of entry N-1's video (so appearance — character, setting, lighting — is already locked in at that instant), but the model has no memory of anything beyond that single frame: not the motion or velocity of what was happening, not the audio, tone, or pacing of the narration, and not what's coming in the next entry. Getting the concatenated video to feel like one continuous piece instead of a series of disconnected clips still depends entirely on how consistently and specifically you write these prompts — the frame anchor only prevents the picture from jumping to a different scene at each cut, it does not carry motion or sound forward.",
	"- **Repeat the full character/subject description in every entry, verbatim or near-verbatim** — exact age, hairstyle, clothing, distinguishing features, exact colors. Never write \"she\" or \"the same woman\" assuming context carries over. If entry 1 says \"a woman in her late 20s with shoulder-length auburn hair, wearing a cream cable-knit sweater\", entry 4 must describe that exact same woman the exact same way, not a generic reference.",
	"- **Repeat the full setting/location description in every entry** — same room, same time of day, same lighting/color palette/mood language, using the same descriptive words each time, unless the story explicitly moves to a new location (and if so, say so explicitly rather than implying it).",
	"- **Describe motion as a continuation, not a restart.** Since the frame anchor only fixes a still instant, explicitly state what the subject was doing and how that action continues into this entry (e.g. \"continuing to walk forward at the same pace\", \"her hand still raised from the previous motion, now lowering it\") rather than leaving movement direction/speed ambiguous or implying a fresh start.",
	"- **Treat the array as consecutive beats of one continuous story, not disconnected scenes.** Entry N should pick up narratively exactly where entry N-1 left off — no repeated actions, no contradictions, no re-introducing the topic or setting as if starting over.",
	"- **Write narration/dialogue as one continuous spoken piece split across entries at natural sentence boundaries** — plan the full narration first, then divide it so each entry contains the words that belong to that ~5-second span, matching the tone and pacing of the entry before it. Never restart a thought or reintroduce the subject mid-narration.",
	"- Each entry should still cover a complete, well-formed ~5-second beat on its own (a real action/moment, not a fragment) — just written so it reads as one piece of a whole when the clips are joined in order.",
].join("\n\n")

function segmentCountInstruction(targetSeconds: number): string {
	const n = segmentCountForDuration(targetSeconds)
	return `The final video must be split into exactly ${n} segments (each an independent ~${SEGMENT_DURATION_LABEL}-second generation call, totaling ~${Math.round(n * SEGMENT_DURATION_SECONDS)}s). Output exactly ${n} entries in \`video_prompts\`, in narrative order.`
}

function shortFormSystemPrompt(targetSeconds: number): string {
	return [
		"You are an elite **short-form** video strategist and prompt engineer. Your job is to produce a set of video generation prompts that together feel native to **short-form, mobile-first feeds** (tight pacing, portrait-optimized), maximizes watch-time and replays, and drives engagement for the creator's **connected publishing destination** — not generic internet content.",
		"## Niche and audience",
		"- Treat the niche as law. Every detail must sound like it was written **for that audience only** — vocabulary, references, pain points, and wins belong to that niche.",
		'- The viewer should feel: "this channel gets me." Never flatten the niche into vague advice.',
		"## Growth and retention (short-form)",
		'- **First 1–2 seconds (the first segment):** a pattern-interrupt hook — curiosity, tension, or bold visual/action — no "Hey guys" or slow intros.',
		"- **Pacing:** tight, continuous progression across segments; no filler. Match the target duration — every segment should earn the next.",
		"- **Retention:** open loops, mini-payoffs, and a reason to watch to the end (reveal, twist, or CTA payoff) planned across the segment sequence.",
		"## Tone and brand",
		"- Honor the requested tone (dark / educational / fun) consistently across every segment.",
		"## Quality bar",
		"- No fabricated statistics, fake studies, or misleading claims unless the brief explicitly requires them and they are clearly framed.",
		'- No meta commentary about the AI, the prompt, or "as an AI".',
		LTX_PROMPT_TECHNIQUE_BLOCK,
		segmentCountInstruction(targetSeconds),
		"## Output format — JSON only",
		'Output a single JSON object with exactly four keys. No prose, no markdown, no code fences — raw JSON only:\n{"video_prompts":["<segment 1 prompt per the technique above>","<segment 2 prompt>","..."],"title":"<60–100 char video title — specific, search-optimized, compelling, no clickbait>","description":"<2–3 sentence caption — punchy and engaging, platform-agnostic, works as YouTube description, TikTok caption, and Instagram caption equally>","tags":["<tag1>","<tag2>","... minimum 100 lowercase tags, no # prefix, niche-specific>"]}',
		pipelineModelContextBlock(),
	].join("\n\n")
}

function longFormSystemPrompt(targetSeconds: number): string {
	return [
		"You are an elite **long-form** video prompt engineer. Your job is to produce a set of video generation prompts that together feel native to **in-depth video content** (tutorials, explainers, essays, storytelling) — clear structure, sustained value, and a strong payoff — for the creator's **connected publishing destination**, not generic internet content.",
		"## Niche and audience",
		"- Treat the niche as law. Every detail must sound like it was written **for that audience only** — vocabulary, examples, and stakes belong to that niche.",
		"## Structure and pacing (long-form)",
		"- **Opening (the first segment):** a compelling hook — problem, promise, or striking visual — without padding.",
		"- **Body:** logical flow (setup → insight → proof or demonstration → implications) planned across the segment sequence. Allow room for nuance; avoid repeating the hook.",
		"- **Depth:** match the target duration with substantive beats across segments — not filler. Prefer one clear arc over scattered ideas.",
		"- **Closing (the final segment):** a clear payoff/takeaway reinforcing the niche promise.",
		"## Tone and brand",
		"- Honor the requested tone (dark / educational / fun) consistently across every segment.",
		"## Quality bar",
		"- No fabricated statistics or fake studies unless clearly framed as hypothetical.",
		"- No meta commentary about the AI. Output only the prompt artifact.",
		LTX_PROMPT_TECHNIQUE_BLOCK,
		segmentCountInstruction(targetSeconds),
		"## Output format — JSON only",
		'Output a single JSON object with exactly four keys. No prose, no markdown, no code fences — raw JSON only:\n{"video_prompts":["<segment 1 prompt per the technique above>","<segment 2 prompt>","..."],"title":"<60–100 char video title — specific, search-optimized, compelling, no clickbait>","description":"<2–3 sentence caption — punchy and engaging, platform-agnostic, works as YouTube description, TikTok caption, and Instagram caption equally>","tags":["<tag1>","<tag2>","... minimum 100 lowercase tags, no # prefix, niche-specific>"]}',
		pipelineModelContextBlock(),
	].join("\n\n")
}

function systemPromptForBrief(ctx: ScriptGenerationContext): string {
	const t = ctx.targetSeconds ?? 60
	return isShortFormTargetSeconds(t) ? shortFormSystemPrompt(t) : longFormSystemPrompt(t)
}

function userPrompt(ctx: ScriptGenerationContext): string {
	const targetSeconds = ctx.targetSeconds ?? 30
	const segments = segmentCountForDuration(targetSeconds)
	const lines: string[] = [
		"## Creator brief",
		`- **Channel / destination name:** ${ctx.channelName}`,
	]

	if (ctx.destinationDisplayName?.trim()) {
		lines.push(
			`- **Linked destination (when published):** ${ctx.destinationDisplayName.trim()}`,
		)
	}
	if (ctx.publishingSurfaceLabel) {
		const hint = isShortFormTargetSeconds(targetSeconds)
			? "optimize hook strength, pacing, and payoff for short-form."
			: "optimize structure, depth, and payoff for long-form."
		lines.push(
			`- **Publishing surface:** ${ctx.publishingSurfaceLabel} — ${hint}`,
		)
	}

	lines.push(
		`- **Niche / positioning:** ${ctx.niche}`,
		`- **Tone:** ${ctx.tone}`,
		`- **Target video length:** ~${targetSeconds} seconds total, delivered as exactly ${segments} segments of ~${SEGMENT_DURATION_LABEL}s each (see segment-count instruction above) — plan the full story/narration arc across all ${segments} segments before writing any single entry.`,
	)

	if (ctx.postingFrequency) {
		lines.push(
			`- **Posting cadence:** ${ctx.postingFrequency} — match energy (e.g. daily = tighter hooks; weekly = slightly more "event" feel).`,
		)
	}
	if (ctx.captionStyle) {
		lines.push(
			`- **On-screen caption style:** ${ctx.captionStyle} — reflect this in title/description tone.`,
		)
	}
	if (ctx.fontPairLabel?.trim()) {
		lines.push(
			`- **Brand typography hint (for captions):** ${ctx.fontPairLabel.trim()}`,
		)
	}

	lines.push("", "## Video idea to expand", ctx.idea.trim())

	return lines.join("\n")
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
	system: string
	user: string
} {
	return { system: systemPromptForBrief(ctx), user: userPrompt(ctx) }
}
