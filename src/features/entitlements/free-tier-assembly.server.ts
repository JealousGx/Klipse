import "@tanstack/react-start/server-only";

import { FreeTierVideoQuotaExhaustedError } from "./errors.server";
import type { UserEntitlementSnapshot } from "./snapshot.server";

/**
 * Free plan: one successful real assembly / content-pipeline output per lifetime (`free_video_consumed`).
 */
export function assertFreeTierAssemblyQuotaAllowed(
	snapshot: Pick<UserEntitlementSnapshot, "plan" | "freeVideoConsumed">,
): void {
	if (snapshot.plan === "free" && snapshot.freeVideoConsumed) {
		throw new FreeTierVideoQuotaExhaustedError();
	}
}
