import "@tanstack/react-start/server-only"

import { logger } from "@/lib/logger"
import type { PolarUsageEventName, PolarUsageMetadata } from "./meter-events"
import { getPolarSdk } from "./polar-sdk.server"

export type PolarIngestEvent = {
	/** Use `POLAR_USAGE_EVENT_NAME` from `meter-events.ts` for the unified meter. */
	name: PolarUsageEventName
	/** Optional deduplication / correlation id (Polar `external_id`). */
	externalId?: string | null
	/** Must include `credits` for Polar **Sum** meter (same units as internal credits). */
	metadata: PolarUsageMetadata
}

/**
 * Server-side batch ingest to Polar (`/v1/events/ingest`).
 * Uses `externalCustomerId` = your Better Auth user id (Polar customer `externalId`).
 */
export async function ingestPolarUsageEvents(input: {
	userId: string
	events: PolarIngestEvent[]
}): Promise<void> {
	if (input.events.length === 0) {
		return
	}

	const polar = getPolarSdk()
	await polar.events.ingest({
		events: input.events.map((e) => ({
			name: e.name,
			externalCustomerId: input.userId,
			...(e.externalId != null ? { externalId: e.externalId } : {}),
			...(e.metadata != null ? { metadata: e.metadata } : {}),
		})),
	})
	logger.info("polar_usage_ingested", {
		userId: input.userId,
		eventCount: input.events.length,
		eventNames: input.events.map((e) => e.name),
	})
}
