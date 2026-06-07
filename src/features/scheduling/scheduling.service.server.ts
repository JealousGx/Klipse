import "@tanstack/react-start/server-only"

import { and, eq, lte } from "drizzle-orm"

import { getDb } from "@/db"
import { channels } from "@/db/schema/channels"
import { schedules } from "@/db/schema/schedules"
import { InsufficientCreditsError } from "@/features/billing/credit-usage.server"
import { TiktokChannelConfigIncompleteError } from "@/features/channels/channel-errors"
import type { ChannelConfig } from "@/features/channels/channel-config.schema"
import { executeContentPipelineWithIdempotency } from "@/features/video/content-pipeline-execute.server"
import { scheduleRowId } from "@/lib/id"
import { logger } from "@/lib/logger"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FREQUENCY_MS: Record<ChannelConfig["posting_frequency"], number> = {
	daily: 1 * 24 * 60 * 60 * 1_000,
	every_2_days: 2 * 24 * 60 * 60 * 1_000,
	every_3_days: 3 * 24 * 60 * 60 * 1_000,
	every_4_days: 4 * 24 * 60 * 60 * 1_000,
	every_5_days: 5 * 24 * 60 * 60 * 1_000,
	every_6_days: 6 * 24 * 60 * 60 * 1_000,
	weekly: 7 * 24 * 60 * 60 * 1_000,
	every_2_weeks: 14 * 24 * 60 * 60 * 1_000,
	every_3_weeks: 21 * 24 * 60 * 60 * 1_000,
	monthly: 30 * 24 * 60 * 60 * 1_000,
}

const DEFAULT_JITTER_MINUTES = 360

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function addJitter(base: Date, jitterMinutes: number): Date {
	const jitterMs = Math.floor(Math.random() * jitterMinutes * 60_000)
	return new Date(base.getTime() + jitterMs)
}

function computeNextRunAt(
	frequency: ChannelConfig["posting_frequency"],
	jitterMinutes: number,
	from = new Date(),
): Date {
	return addJitter(
		new Date(from.getTime() + FREQUENCY_MS[frequency]),
		jitterMinutes,
	)
}

// ---------------------------------------------------------------------------
// Upsert
// ---------------------------------------------------------------------------

/**
 * Create or update the schedule for a channel.
 * Called whenever a channel is created or its `posting_frequency` changes.
 * One schedule per channel is enforced by the unique constraint on `channelId`.
 */
export async function upsertChannelSchedule(input: {
	userId: string
	channelId: string
	frequency: ChannelConfig["posting_frequency"]
	jitterMinutes?: number
	enabled?: boolean
}): Promise<void> {
	const db = getDb()
	const now = new Date()
	const jitter = input.jitterMinutes ?? DEFAULT_JITTER_MINUTES

	const [existing] = await db
		.select({
			id: schedules.id,
			frequency: schedules.frequency,
			nextRunAt: schedules.nextRunAt,
		})
		.from(schedules)
		.where(eq(schedules.channelId, input.channelId))
		.limit(1)

	if (!existing) {
		// First schedule for this channel — set nextRunAt in the future with jitter
		// so all newly-created channels don't fire simultaneously.
		await db.insert(schedules).values({
			id: scheduleRowId(),
			userId: input.userId,
			channelId: input.channelId,
			frequency: input.frequency,
			nextRunAt: computeNextRunAt(input.frequency, jitter, now),
			jitterMinutes: jitter,
			enabled: input.enabled ?? true,
			createdAt: now,
			updatedAt: now,
		})
		return
	}

	// Only recalculate nextRunAt if the frequency changed — preserves the existing
	// scheduled time for same-frequency updates (e.g. toggling enabled only).
	const patch: Partial<typeof schedules.$inferInsert> = {
		enabled:
			(input.enabled ?? existing.frequency === input.frequency)
				? (input.enabled ?? undefined)
				: true,
		jitterMinutes: jitter,
		updatedAt: now,
	}

	if (existing.frequency !== input.frequency) {
		patch.frequency = input.frequency
		patch.nextRunAt = computeNextRunAt(input.frequency, jitter, now)
		patch.enabled = input.enabled ?? true
	}

	await db.update(schedules).set(patch).where(eq(schedules.id, existing.id))
}

// ---------------------------------------------------------------------------
// Pause / resume
// ---------------------------------------------------------------------------

export async function pauseScheduleForChannel(
	userId: string,
	channelId: string,
): Promise<void> {
	const db = getDb()
	await db
		.update(schedules)
		.set({ enabled: false, updatedAt: new Date() })
		.where(
			and(eq(schedules.channelId, channelId), eq(schedules.userId, userId)),
		)
}

export async function resumeScheduleForChannel(
	userId: string,
	channelId: string,
): Promise<void> {
	const db = getDb()
	await db
		.update(schedules)
		.set({ enabled: true, updatedAt: new Date() })
		.where(
			and(eq(schedules.channelId, channelId), eq(schedules.userId, userId)),
		)
}

export async function getScheduleForChannel(
	userId: string,
	channelId: string,
): Promise<typeof schedules.$inferSelect | null> {
	const db = getDb()
	const [row] = await db
		.select()
		.from(schedules)
		.where(
			and(eq(schedules.channelId, channelId), eq(schedules.userId, userId)),
		)
		.limit(1)
	return row ?? null
}

// ---------------------------------------------------------------------------
// Fast-forward (trigger schedule now — Creator+ only)
// ---------------------------------------------------------------------------

export type TriggerNowResult =
	| { ok: true }
	| {
			ok: false
			code: "no_schedule" | "not_connected" | "insufficient_credits" | "error"
	  }

/**
 * Fires the content pipeline immediately for a channel's schedule, then advances
 * `nextRunAt` exactly as the cron would — so the next *scheduled* run isn't
 * double-fired.  The idempotency key uses the current timestamp (not `nextRunAt`)
 * so it never conflicts with a scheduled run for the same slot.
 *
 * Caller must verify the user has a Creator+ plan before calling this.
 */
export async function triggerScheduleNowForChannel(
	userId: string,
	channelId: string,
): Promise<TriggerNowResult> {
	const db = getDb()
	const now = new Date()

	const [row] = await db
		.select({
			id: schedules.id,
			frequency: schedules.frequency,
			jitterMinutes: schedules.jitterMinutes,
			channelNiche: channels.niche,
			oauthRefreshToken: channels.oauthRefreshToken,
		})
		.from(schedules)
		.innerJoin(channels, eq(schedules.channelId, channels.id))
		.where(
			and(eq(schedules.channelId, channelId), eq(schedules.userId, userId)),
		)
		.limit(1)

	if (!row) {
		return { ok: false, code: "no_schedule" }
	}

	if (!row.oauthRefreshToken) {
		return { ok: false, code: "not_connected" }
	}

	const idempotencyKey = `schedule-now:${row.id}:${now.toISOString()}`
	const nextRunAt = computeNextRunAt(row.frequency, row.jitterMinutes, now)

	try {
		await executeContentPipelineWithIdempotency({
			userId,
			channelId,
			idempotencyKey,
			idea: row.channelNiche.trim() || "Create an engaging video.",
		})

		await db
			.update(schedules)
			.set({ lastRunAt: now, nextRunAt, updatedAt: now })
			.where(eq(schedules.id, row.id))

		return { ok: true }
	} catch (e) {
		if (e instanceof InsufficientCreditsError) {
			return { ok: false, code: "insufficient_credits" }
		}
		logger.error("[scheduling] triggerScheduleNow failed", {
			channelId,
			error: e instanceof Error ? e.message : String(e),
		})
		return { ok: false, code: "error" }
	}
}

// ---------------------------------------------------------------------------
// Cron trigger
// ---------------------------------------------------------------------------

export type TriggerSchedulesResult = {
	triggered: number
	skipped: number
	errors: number
}

/**
 * Called by the cron endpoint every 15 minutes.
 * Fires content pipeline jobs for all due schedules, then advances `nextRunAt`.
 *
 * Error handling:
 * - `InsufficientCreditsError` → advance nextRunAt anyway (no point retrying the same slot).
 * - Other errors → advance nextRunAt (accept one missed slot; log for observability).
 *
 * Idempotency: the idempotency key `schedule:{id}:{nextRunAt.toISOString()}` ensures that
 * even if the cron fires twice within a window, only one pipeline job is created.
 */
export async function triggerDueSchedules(): Promise<TriggerSchedulesResult> {
	const db = getDb()
	const now = new Date()

	const due = await db
		.select({
			id: schedules.id,
			userId: schedules.userId,
			channelId: schedules.channelId,
			frequency: schedules.frequency,
			nextRunAt: schedules.nextRunAt,
			jitterMinutes: schedules.jitterMinutes,
			channelNiche: channels.niche,
		})
		.from(schedules)
		.innerJoin(channels, eq(schedules.channelId, channels.id))
		.where(and(eq(schedules.enabled, true), lte(schedules.nextRunAt, now)))

	let triggered = 0
	let skipped = 0
	let errors = 0

	for (const schedule of due) {
		const idempotencyKey = `schedule:${schedule.id}:${schedule.nextRunAt.toISOString()}`
		const nextRunAt = computeNextRunAt(
			schedule.frequency,
			schedule.jitterMinutes,
			now,
		)

		try {
			const outcome = await executeContentPipelineWithIdempotency({
				userId: schedule.userId,
				channelId: schedule.channelId,
				idempotencyKey,
				// Channel niche drives the video topic for each scheduled run.
				idea: schedule.channelNiche.trim() || "Create an engaging video.",
			})

			await db
				.update(schedules)
				.set({ lastRunAt: now, nextRunAt, updatedAt: now })
				.where(eq(schedules.id, schedule.id))

			if (outcome.kind === "replay") {
				skipped++
			} else {
				triggered++
			}
		} catch (e) {
			if (e instanceof InsufficientCreditsError) {
				// User has no credits — advance nextRunAt so we don't retry every 15 min.
				logger.warn("[scheduling] insufficient credits for schedule", {
					scheduleId: schedule.id,
					userId: schedule.userId,
				})
			} else if (e instanceof TiktokChannelConfigIncompleteError) {
				// TikTok destination missing required config — skip silently until user fixes it.
				logger.warn(
					"[scheduling] tiktok config incomplete, skipping schedule",
					{
						scheduleId: schedule.id,
						userId: schedule.userId,
						reason: e.reason,
					},
				)
			} else {
				logger.error("[scheduling] pipeline failed for schedule", {
					scheduleId: schedule.id,
					userId: schedule.userId,
					error: e instanceof Error ? e.message : String(e),
				})
			}
			// Always advance nextRunAt to avoid accumulation of past-due slots.
			await db
				.update(schedules)
				.set({ nextRunAt, updatedAt: now })
				.where(eq(schedules.id, schedule.id))
			errors++
		}
	}

	return { triggered, skipped, errors }
}
