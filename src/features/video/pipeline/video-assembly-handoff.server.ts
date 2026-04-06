import "@tanstack/react-start/server-only";

import {
	type VideoProcessorHandoffPayload,
	videoJobAssemblyOutputKey,
} from "@klipse/video-assembly-shared";
import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { videoJobs } from "@/db/schema/video-jobs";
import { env } from "@/env";
import { mysqlAffectedRowsFromUpdateResult } from "@/lib/db/mysql-affected-rows.server";
import { presignPutVideoToR2 } from "@/lib/storage/r2.server";
import { getAppPublicBaseUrl } from "@/lib/video-processor/app-base-url.server";

import { isVideoAssemblyPipelineKind, PIPELINE_STAGE } from "./pipeline-kind";
import { markVideoJobFailed } from "./process-stub-pipeline.server";

function requireExternalProcessorEnv(): {
	processorBaseUrl: string;
	clientSecret: string;
} {
	const url = env.VIDEO_PROCESSOR_URL?.trim();
	const clientSecret = env.VIDEO_PROCESSOR_CLIENT_SECRET?.trim();
	const webhookSecret = env.VIDEO_PROCESSOR_WEBHOOK_SECRET?.trim();
	if (!url || !clientSecret || !webhookSecret) {
		throw new Error(
			"VIDEO_PROCESSOR_URL, VIDEO_PROCESSOR_CLIENT_SECRET, and VIDEO_PROCESSOR_WEBHOOK_SECRET are required for external video assembly",
		);
	}
	getAppPublicBaseUrl();
	return { processorBaseUrl: url.replace(/\/$/, ""), clientSecret };
}

export function isExternalVideoProcessorConfigured(): boolean {
	const publicBase = (env.APP_PUBLIC_URL ?? env.SERVER_URL)?.trim();
	return Boolean(
		env.VIDEO_PROCESSOR_URL?.trim() &&
			env.VIDEO_PROCESSOR_CLIENT_SECRET?.trim() &&
			env.VIDEO_PROCESSOR_WEBHOOK_SECRET?.trim() &&
			publicBase,
	);
}

/**
 * Hand off assembly to the external encoder: `queued` → `dispatched` (presign + POST),
 * then `dispatched` → `processing` only after the processor returns **202** (accepted).
 * Duplicate dispatch is a no-op for terminal/`processing` jobs; `dispatched` retries
 * presign + POST (processor should be idempotent on `jobId`).
 */
export async function handoffVideoAssemblyToExternalProcessor(
	jobId: string,
): Promise<void> {
	const { processorBaseUrl, clientSecret } = requireExternalProcessorEnv();
	const db = getDb();
	const id = jobId.trim();

	const [job] = await db
		.select({
			id: videoJobs.id,
			userId: videoJobs.userId,
			pipelineKind: videoJobs.pipelineKind,
			status: videoJobs.status,
		})
		.from(videoJobs)
		.where(eq(videoJobs.id, id))
		.limit(1);

	if (!job) {
		throw new Error("video_job_not_found");
	}
	if (!isVideoAssemblyPipelineKind(job.pipelineKind)) {
		throw new Error("video_job_pipeline_mismatch");
	}
	if (job.status === "completed" || job.status === "failed") {
		return;
	}
	if (job.status === "processing") {
		return;
	}

	if (job.status === "queued") {
		const now = new Date();
		const updateResult = await db
			.update(videoJobs)
			.set({
				status: "dispatched",
				progress: 5,
				currentStage: PIPELINE_STAGE.DISPATCH_PENDING,
				updatedAt: now,
			})
			.where(and(eq(videoJobs.id, id), eq(videoJobs.status, "queued")));

		if (mysqlAffectedRowsFromUpdateResult(updateResult) === 0) {
			return;
		}
	} else if (job.status !== "dispatched") {
		return;
	}

	const objectKey = videoJobAssemblyOutputKey(job.userId, id);
	let presignedPutUrl: string;
	try {
		const presigned = await presignPutVideoToR2({
			key: objectKey,
			contentType: "video/mp4",
			expiresIn: 900,
		});
		presignedPutUrl = presigned.url;
	} catch (e) {
		console.error("[video-assembly-handoff] presign failed", e);
		await markVideoJobFailed({
			jobId: id,
			message: "presign_failed",
		});
		return;
	}

	const base = getAppPublicBaseUrl();
	const completeWebhookUrl = `${base}/api/internal/video-processor/assembly-complete`;

	const payload: VideoProcessorHandoffPayload = {
		jobId: id,
		userId: job.userId,
		presignedPutUrl,
		contentType: "video/mp4",
		completeWebhookUrl,
	};

	try {
		const res = await fetch(`${processorBaseUrl}/v1/process`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${clientSecret}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(payload),
			signal: AbortSignal.timeout(30_000),
		});

		if (res.status !== 202) {
			const text = await res.text().catch(() => "");
			await markVideoJobFailed({
				jobId: id,
				message: `processor_handoff_${res.status}:${text.slice(0, 500)}`,
			});
			return;
		}

		const advance = await db
			.update(videoJobs)
			.set({
				status: "processing",
				progress: 15,
				currentStage: PIPELINE_STAGE.ASSEMBLE,
				updatedAt: new Date(),
			})
			.where(and(eq(videoJobs.id, id), eq(videoJobs.status, "dispatched")));

		if (mysqlAffectedRowsFromUpdateResult(advance) === 0) {
			console.warn(
				"[video-assembly-handoff] accepted 202 but job was not dispatched (race or terminal)",
				{ jobId: id },
			);
		}
	} catch (e) {
		console.error("[video-assembly-handoff] processor unreachable", e);
		await markVideoJobFailed({
			jobId: id,
			message:
				e instanceof Error ? e.message.slice(0, 500) : "processor_unreachable",
		});
	}
}
