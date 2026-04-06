import "@tanstack/react-start/server-only";

import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import type { VideoJobArtifacts } from "@/db/schema/video-jobs";
import { videoJobs } from "@/db/schema/video-jobs";
import { ScriptGenerationFailedError } from "@/features/ai/errors";
import { channelToCreativeBrief } from "@/features/ai/prompts/channel-brief.server";
import { generateVideoScript } from "@/features/ai/script-generation.server";
import { getChannelForUser } from "@/features/channels/channels.service.server";
import { mysqlAffectedRowsFromUpdateResult } from "@/lib/db/mysql-affected-rows.server";
import {
	enqueueVideoJobDispatch,
	WorkerEnqueueFailedError,
} from "@/lib/worker/enqueue.server";

import { PIPELINE_KIND, PIPELINE_STAGE } from "./pipeline-kind";
import { markVideoJobFailed } from "./process-stub-pipeline.server";

/**
 * Runs the script stage for {@link PIPELINE_KIND.CONTENT_PIPELINE_V1}: claims the row,
 * calls AI (Pollinations → Gemini), persists {@link VideoJobArtifacts}, then queues assembly.
 */
export async function processScriptStage(jobId: string): Promise<void> {
	const db = getDb();
	const id = jobId.trim();

	const [row] = await db
		.select({
			id: videoJobs.id,
			userId: videoJobs.userId,
			channelId: videoJobs.channelId,
			pipelineKind: videoJobs.pipelineKind,
			status: videoJobs.status,
			currentStage: videoJobs.currentStage,
			inputPayload: videoJobs.inputPayload,
			artifacts: videoJobs.artifacts,
		})
		.from(videoJobs)
		.where(eq(videoJobs.id, id))
		.limit(1);

	if (!row) {
		throw new Error("video_job_not_found");
	}
	if (row.pipelineKind !== PIPELINE_KIND.CONTENT_PIPELINE_V1) {
		throw new Error("video_job_pipeline_mismatch");
	}
	if (row.status === "completed" || row.status === "failed") {
		return;
	}

	// Recovery: script finished but handoff to assembly failed — advance and re-dispatch.
	if (
		row.status === "processing" &&
		row.currentStage === PIPELINE_STAGE.SCRIPT &&
		row.artifacts?.scriptText
	) {
		await finalizeScriptAndQueueAssembly({
			jobId: id,
			userId: row.userId,
			artifacts: row.artifacts,
		});
		return;
	}

	if (row.currentStage !== PIPELINE_STAGE.SCRIPT) {
		return;
	}

	if (row.status === "dispatched") {
		return;
	}

	// Another worker is generating the script.
	if (row.status === "processing" && !row.artifacts?.scriptText) {
		return;
	}

	if (row.status !== "queued") {
		return;
	}

	const idea = row.inputPayload?.idea?.trim();
	if (!idea) {
		await markVideoJobFailed({
			jobId: id,
			message: "missing_idea",
		});
		return;
	}

	const claim = await db
		.update(videoJobs)
		.set({
			status: "processing",
			progress: 12,
			currentStage: PIPELINE_STAGE.SCRIPT,
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(videoJobs.id, id),
				eq(videoJobs.status, "queued"),
				eq(videoJobs.currentStage, PIPELINE_STAGE.SCRIPT),
			),
		);

	if (mysqlAffectedRowsFromUpdateResult(claim) === 0) {
		return;
	}

	const channel = await getChannelForUser(row.userId, row.channelId);
	if (!channel) {
		await markVideoJobFailed({ jobId: id, message: "channel_not_found" });
		return;
	}

	try {
		const { text } = await generateVideoScript({
			idea,
			...channelToCreativeBrief(channel),
		});

		const artifacts: VideoJobArtifacts = {
			scriptText: text,
		};

		await finalizeScriptAndQueueAssembly({
			jobId: id,
			userId: row.userId,
			artifacts,
		});
	} catch (e) {
		if (e instanceof WorkerEnqueueFailedError) {
			return;
		}
		if (e instanceof ScriptGenerationFailedError) {
			const detail = [e.message, ...e.attempts].join(" | ").slice(0, 3800);
			console.error("[script-stage]", e);
			await markVideoJobFailed({ jobId: id, message: detail });
			return;
		}
		const message =
			e instanceof Error ? e.message.slice(0, 500) : "script_generation_failed";
		console.error("[script-stage]", e);
		await markVideoJobFailed({ jobId: id, message });
	}
}

async function finalizeScriptAndQueueAssembly(input: {
	jobId: string;
	userId: string;
	artifacts: VideoJobArtifacts;
}): Promise<void> {
	const db = getDb();
	const id = input.jobId.trim();
	const now = new Date();
	const advanced = await db
		.update(videoJobs)
		.set({
			status: "queued",
			progress: 45,
			currentStage: PIPELINE_STAGE.ASSEMBLE,
			artifacts: input.artifacts,
			updatedAt: now,
		})
		.where(
			and(
				eq(videoJobs.id, id),
				eq(videoJobs.pipelineKind, PIPELINE_KIND.CONTENT_PIPELINE_V1),
				eq(videoJobs.currentStage, PIPELINE_STAGE.SCRIPT),
			),
		);

	if (mysqlAffectedRowsFromUpdateResult(advanced) === 0) {
		return;
	}

	await enqueueVideoJobDispatch({
		jobId: id,
		userId: input.userId,
		pipelineKind: PIPELINE_KIND.CONTENT_PIPELINE_V1,
	});
}
