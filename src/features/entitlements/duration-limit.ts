import type { MeResponse } from "@/features/user/types/me"

/**
 * Maximum video duration (seconds) each plan may request from the encoder (FEATURE_DOC §10.3).
 * Free and Starter are capped at 30 s; Creator at 60 s; Empire gets the channel config maximum.
 */
export const MAX_DURATION_SECONDS_BY_PLAN: Record<MeResponse["plan"], number> =
	{
		free: 30,
		starter: 30,
		creator: 60,
		empire: 600,
	}

/**
 * Returns the lesser of the requested duration and the plan cap.
 * The processor always receives a value within its allowed range; no plan can
 * exceed its limit by setting a large `target_duration` on the channel config.
 */
export function clampTargetDuration(
	requestedSeconds: number,
	plan: MeResponse["plan"],
): number {
	return Math.min(requestedSeconds, MAX_DURATION_SECONDS_BY_PLAN[plan])
}
