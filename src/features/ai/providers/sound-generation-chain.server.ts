import "@tanstack/react-start/server-only";

import type { MeResponse } from "@/features/user/types/me";

import type { ChannelCreativeBrief } from "../prompts/creative-brief.types";
import {
	generateSoundElevenLabs,
	isElevenLabsConfigured,
} from "./elevenlabs-sound.server";

export type SoundGenerationSource = "elevenlabs";

export type GenerateSoundInput = {
	/** Channel creative brief used to auto-generate a prompt if no hint provided. */
	brief: ChannelCreativeBrief;
	/** Duration of the video (seconds) — sound will match this length. */
	targetSeconds: number;
	/**
	 * Admin-defined prompt hint for this channel (e.g. "calm ambient background music").
	 * Falls back to auto-generation from brief niche + tone.
	 */
	soundPromptHint?: string | null;
	/** User plan — Creator+ required to use this feature. */
	plan: MeResponse["plan"];
	/** Whether this channel has sound enabled (toggle in destination settings). */
	soundEnabled: boolean;
};

/** Plans that have access to sound generation. */
const SOUND_ALLOWED_PLANS: MeResponse["plan"][] = ["creator", "empire"];

/**
 * Sound generation chain — Creator+ only.
 *
 * Returns null when:
 * - soundEnabled is false on the channel
 * - User is not on Creator+ plan
 * - No ElevenLabs keys configured
 *
 * Never throws from entitlement/config checks — the pipeline should continue
 * without sound rather than failing the entire video job.
 *
 * Chain: ElevenLabs Sound Generation (with key rotation)
 * Future: add fallback providers here without changing callers.
 */
export async function generateSoundWithFallback(
	input: GenerateSoundInput,
): Promise<{ source: SoundGenerationSource; buffer: ArrayBuffer } | null> {
	// Feature gate: channel toggle + plan check.
	if (!input.soundEnabled) return null;
	if (!SOUND_ALLOWED_PLANS.includes(input.plan)) return null;
	if (!(await isElevenLabsConfigured())) return null;

	const prompt = buildSoundPrompt(input.brief, input.soundPromptHint);

	try {
		const buffer = await generateSoundElevenLabs({
			prompt,
			durationSeconds: Math.min(input.targetSeconds, 22), // ElevenLabs max is 22s
		});
		return { source: "elevenlabs", buffer };
	} catch (e) {
		// Log but don't fail the video job — sound is an enhancement, not required.
		console.warn(
			"[sound-generation] ElevenLabs failed, skipping sound:",
			e instanceof Error ? e.message : String(e),
		);
		return null;
	}
}

/**
 * Build a sound effect prompt from the channel brief if no hint is provided.
 * Keeps it short and descriptive for best ElevenLabs results.
 */
function buildSoundPrompt(
	brief: ChannelCreativeBrief,
	hint?: string | null,
): string {
	if (hint?.trim()) return hint.trim();

	const tone = brief.tone?.toLowerCase() ?? "neutral";
	const niche = brief.niche ?? "general";

	if (tone === "dark")
		return `dark atmospheric ambient sound for ${niche} video background`;
	if (tone === "fun")
		return `upbeat energetic background sound effect for ${niche} video`;
	if (tone === "educational")
		return `calm focused ambient music for ${niche} educational video`;
	return `subtle ambient background sound for ${niche} video`;
}
