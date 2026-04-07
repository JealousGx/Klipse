import type { PublishingPlatform } from "@/features/channels/external-channel.schema";

/**
 * Inclusive upper bound (seconds) for **short-form** prompt tuning (feeds, Reels/Shorts-style).
 * Above this, prompts assume **long-form** (tutorials, essays, main YouTube uploads, etc.).
 * Tune per product research; not tied to encoding or upload APIs.
 */
export const SHORT_FORM_TARGET_SECONDS_MAX = 180;

export function isShortFormTargetSeconds(targetSeconds: number): boolean {
	return targetSeconds <= SHORT_FORM_TARGET_SECONDS_MAX;
}

/**
 * Neutral format copy for prompts — not a single vendor or app name.
 * `platform` is reserved for per-integration overrides (aspect defaults, copy tweaks).
 */
export function publishingSurfaceLabel(
	_platform: PublishingPlatform,
	targetSeconds: number,
): string {
	void _platform;
	if (isShortFormTargetSeconds(targetSeconds)) {
		return "Short-form vertical video (mobile-first feeds — Reels, Shorts, TikTok-style)";
	}
	return "Long-form video (wider pacing and framing — tutorials, essays, explainers, main-channel uploads)";
}
