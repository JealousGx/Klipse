import { relations, sql } from "drizzle-orm"
import {
	index,
	int,
	json,
	mysqlEnum,
	mysqlTable,
	text,
	timestamp,
	varchar,
} from "drizzle-orm/mysql-core"

import { channels } from "./channels"
import { users } from "./users"

/** Immutable request payload for pipelines that need user input (e.g. content pipeline). */
export type VideoJobInputPayload = {
	idea: string
}

/**
 * User-selected publish settings captured during the pre-publish review step.
 * Stored as JSON — extend with new platform-specific keys as needed.
 */
export type VideoJobPublishSettings = {
	/** User-selected privacy level (e.g. TikTok `PUBLIC_TO_EVERYONE`). Falls back to auto-pick if absent. */
	privacyLevel?: string
	/** TikTok commercial content disclosure selections. Only populated for TikTok jobs. */
	tiktokDisclosure?: {
		enabled: boolean
		/** "Your brand" — brand_organic_toggle in TikTok API. */
		brandOrganic: boolean
		/** "Branded content" — brand_content_toggle in TikTok API. */
		brandedContent: boolean
	}
}

/** Intermediate outputs produced by multi-stage pipelines (script text, AI metadata, etc.). */
export type VideoJobArtifacts = {
	scriptText?: string
	/** AI-generated video title. */
	title?: string
	/** AI-generated short caption — usable as YouTube description, TikTok/Instagram caption. */
	description?: string
	/** AI-generated tags (lowercase, no # prefix). */
	tags?: string[]
	/** Actual encoded video duration in whole seconds — probed from the final output by the processor. */
	durationSec?: number
}

export const videoJobs = mysqlTable(
	"video_jobs",
	{
		id: varchar("id", { length: 64 }).primaryKey(),
		userId: varchar("user_id", { length: 64 })
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		channelId: varchar("channel_id", { length: 64 })
			.notNull()
			.references(() => channels.id, { onDelete: "cascade" }),
		/**
		 * Which pipeline implementation owns this row (stub, full render, publish-only, …).
		 * Not a publishing platform — use `channels.platform` for YouTube/TikTok/…
		 */
		pipelineKind: varchar("pipeline_kind", { length: 32 })
			.notNull()
			.default("content_pipeline_v1"),
		/**
		 * User input at job creation (e.g. video idea). Null for older rows or stub-only jobs.
		 */
		inputPayload: json("input_payload").$type<VideoJobInputPayload | null>(),
		/** Pipeline outputs not yet reflected in `output_url` (e.g. generated script). */
		artifacts: json("artifacts").$type<VideoJobArtifacts | null>(),
		status: mysqlEnum("status", [
			"queued",
			"dispatched",
			"processing",
			"completed",
			"failed",
		])
			.notNull()
			.default("queued"),
		progress: int("progress").notNull().default(0),
		currentStage: varchar("current_stage", { length: 64 }),
		costCredits: int("cost_credits").notNull().default(0),
		outputUrl: text("output_url"),
		errorMessage: text("error_message"),
		/**
		 * Paid destinations only: when `channels.config.auto_post` is false, set to `pending`
		 * after the video is ready so publishing waits for user action (FEATURE_DOC §2.14).
		 */
		publishApprovalStatus: mysqlEnum("publish_approval_status", [
			"pending",
			"approved",
			"rejected",
		]),
		/** Platform-assigned video id after a successful publish (e.g. YouTube `videoId`). */
		publishedVideoId: varchar("published_video_id", { length: 64 }),
		publishedAt: timestamp("published_at", { fsp: 3 }),
		/**
		 * Set when a publish attempt is in flight so concurrent queue deliveries
		 * do not create duplicate uploads. Cleared on success or failure.
		 */
		publishStartedAt: timestamp("publish_started_at", { fsp: 3 }),
		/** Last publish error message (user-visible; cleared on success). */
		publishLastError: text("publish_last_error"),
		/**
		 * User-selected publish settings captured during the pre-publish review step.
		 * Includes privacy level selection and TikTok commercial content disclosure choices.
		 * Falls back to platform defaults if absent (e.g. older jobs, non-TikTok platforms).
		 */
		publishSettings: json(
			"publish_settings",
		).$type<VideoJobPublishSettings | null>(),
		/**
		 * User-edited caption/description set during the pre-publish review step.
		 * When set, platform publish functions use this instead of auto-generating.
		 * Platform-agnostic — used for TikTok caption and YouTube description override.
		 */
		publishCaptionOverride: varchar("publish_caption_override", {
			length: 5000,
		}),
		/**
		 * Number of times this job has been manually retried from the dashboard after
		 * reaching `failed`. Capped at 3 (FEATURE_DOC §DLQ).
		 */
		retryCount: int("retry_count").notNull().default(0),
		/**
		 * Number of manual publish retries triggered from the dashboard.
		 * Platform-agnostic — counts across YouTube, TikTok, etc. Capped at 3.
		 */
		publishRetryCount: int("publish_retry_count").notNull().default(0),
		createdAt: timestamp("created_at", { fsp: 3 })
			.default(sql`CURRENT_TIMESTAMP(3)`)
			.notNull(),
		updatedAt: timestamp("updated_at", { fsp: 3 })
			.default(sql`CURRENT_TIMESTAMP(3)`)
			.notNull(),
	},
	(table) => [
		index("video_jobs_userId_idx").on(table.userId),
		index("video_jobs_channelId_idx").on(table.channelId),
		index("video_jobs_createdAt_idx").on(table.createdAt),
	],
)

export const videoJobsRelations = relations(videoJobs, ({ one }) => ({
	user: one(users, {
		fields: [videoJobs.userId],
		references: [users.id],
	}),
	channel: one(channels, {
		fields: [videoJobs.channelId],
		references: [channels.id],
	}),
}))
