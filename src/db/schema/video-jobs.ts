import { relations, sql } from "drizzle-orm";
import {
	index,
	int,
	json,
	mysqlEnum,
	mysqlTable,
	text,
	timestamp,
	varchar,
} from "drizzle-orm/mysql-core";

import { channels } from "./channels";
import { users } from "./users";

/** Immutable request payload for pipelines that need user input (e.g. content pipeline). */
export type VideoJobInputPayload = {
	idea: string;
};

/** Intermediate outputs produced by multi-stage pipelines (script text, etc.). */
export type VideoJobArtifacts = {
	scriptText?: string;
};

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
			.default("stub_pipeline"),
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
);

export const videoJobsRelations = relations(videoJobs, ({ one }) => ({
	user: one(users, {
		fields: [videoJobs.userId],
		references: [users.id],
	}),
	channel: one(channels, {
		fields: [videoJobs.channelId],
		references: [channels.id],
	}),
}));
