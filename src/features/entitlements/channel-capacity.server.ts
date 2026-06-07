import "@tanstack/react-start/server-only"

import { MAX_CHANNELS_BY_PLAN } from "@/features/billing/tier-config"
import { ChannelLimitError } from "@/features/channels/channel-errors"
import type { MeResponse } from "@/features/user/types/me"

/**
 * Enforces {@link MAX_CHANNELS_BY_PLAN} for the user's current plan.
 */
export function assertChannelCapacity(input: {
	plan: MeResponse["plan"]
	currentChannelCount: number
}): void {
	const max = MAX_CHANNELS_BY_PLAN[input.plan]
	if (input.currentChannelCount >= max) {
		throw new ChannelLimitError(max, input.plan)
	}
}
