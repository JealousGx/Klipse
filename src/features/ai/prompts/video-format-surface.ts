/**
 * Duration-based format hints for prompt tuning.
 * These inform script pacing (tight vs. deep) — they are not tied to any
 * specific publishing platform, app, or brand name.
 */
export const SHORT_FORM_TARGET_SECONDS_MAX = 180;

export function isShortFormTargetSeconds(targetSeconds: number): boolean {
	return targetSeconds <= SHORT_FORM_TARGET_SECONDS_MAX;
}

/**
 * Returns a neutral format description based solely on target duration.
 * Used in AI prompts to guide pacing — not a platform or product name.
 */
export function publishingSurfaceLabel(targetSeconds: number): string {
	return isShortFormTargetSeconds(targetSeconds)
		? "Short-form video"
		: "Long-form video";
}
