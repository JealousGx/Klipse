import "@tanstack/react-start/server-only"

import type { MeResponse } from "@/features/user/types/me"

/**
 * Future: branch **premium** (paid-tier) provider order / model ids.
 * Today everything uses {@link STANDARD_ROUTING} behavior in provider chains.
 */
export type AiRoutingTier = "standard" | "premium"

/** All jobs use standard Primary → Fallback order until premium is productized. */
export const STANDARD_ROUTING: AiRoutingTier = "standard"

/**
 * Resolve which routing tier applies for AI calls. Extend when you add paid-tier
 * overrides (e.g. return `"premium"` for `creator`+ plans).
 */
export function resolveAiRoutingTier(_input: {
	userId?: string
	plan?: MeResponse["plan"]
}): AiRoutingTier {
	return STANDARD_ROUTING
}
