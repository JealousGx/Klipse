import "@tanstack/react-start/server-only";

import type { ProcessorJobSpec } from "@klipse/video-assembly-shared";
import { and, eq, or } from "drizzle-orm";
import { getDb } from "@/db";
import { videoJobs } from "@/db/schema/video-jobs";
import { env } from "@/env";
import { mysqlAffectedRowsFromUpdateResult } from "@/lib/db/mysql-affected-rows.server";

import { buildProcessorJobSpec } from "./build-processor-job-spec.server";
import { PIPELINE_STAGE } from "./pipeline-kind";
import { markVideoJobFailed } from "./process-stub-pipeline.server";

function requireProcessorEnv(): {
	processorBaseUrl: string;
	clientSecret: string;
} {
	const url = env.VIDEO_PROCESSOR_URL?.trim();
	const clientSecret = env.VIDEO_PROCESSOR_CLIENT_SECRET?.trim();
	const webhookSecret = env.VIDEO_PROCESSOR_WEBHOOK_SECRET?.trim();
	if (!url || !clientSecret || !webhookSecret) {
		throw new Error(
			"VIDEO_PROCESSOR_URL, VIDEO_PROCESSOR_CLIENT_SECRET, and VIDEO_PROCESSOR_WEBHOOK_SECRET required",
		);
	}
	return { processorBaseUrl: url.replace(/\/$/, ""), clientSecret };
}

export function isContentProcessorConfigured(): boolean {
	const publicBase = (env.APP_PUBLIC_URL ?? env.SERVER_URL)?.trim();
	return Boolean(
		env.VIDEO_PROCESSOR_URL?.trim() &&
			env.VIDEO_PROCESSOR_CLIENT_SECRET?.trim() &&
			env.VIDEO_PROCESSOR_WEBHOOK_SECRET?.trim() &&
			publicBase,
	);
}

/**
 * Dispatches a content_pipeline_v1 job to the external processor (Cloud Run).
 * Transitions: queued → dispatched (status) / dispatch_pending (stage) → builds
 * ProcessorJobSpec → POSTs to processor → processing / script.
 * The processor handles: script → TTS + images + sound → FFmpeg → R2 upload → callback.
 *
 * Also re-dispatches if job is stuck in dispatched + dispatch_pending (crash between
 * the CAS claim and the fetch to the processor).
 */
export async function dispatchContentJob(jobId: string): Promise<void> {
	const db = getDb();
	const id = jobId.trim();

	// Claim: queued → dispatched/dispatch_pending.
	// Also covers the crash-recovery case: dispatched + dispatch_pending (spec POST
	// never reached the processor) — re-sets updatedAt so the row appears active.
	const claim = await db
		.update(videoJobs)
		.set({
			status: "dispatched",
			progress: 5,
			currentStage: PIPELINE_STAGE.DISPATCH_PENDING,
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(videoJobs.id, id),
				or(
					eq(videoJobs.status, "queued"),
					and(
						eq(videoJobs.status, "dispatched"),
						eq(videoJobs.currentStage, PIPELINE_STAGE.DISPATCH_PENDING),
					),
				),
			),
		);

	if (mysqlAffectedRowsFromUpdateResult(claim) === 0) {
		return; // already dispatched or terminal
	}

	const { processorBaseUrl, clientSecret } = requireProcessorEnv();

	let spec: ProcessorJobSpec;
	try {
		spec = await buildProcessorJobSpec(id);
	} catch (e) {
		const msg =
			e instanceof Error ? e.message.slice(0, 500) : "spec_build_failed";
		console.error("[dispatch-content-job] spec build failed", e);
		await markVideoJobFailed({ jobId: id, message: msg });
		return;
	}

	let res: Response;
	try {
		res = await fetch(`${processorBaseUrl}/v1/process-spec`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${clientSecret}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(spec),
			signal: AbortSignal.timeout(30_000),
		});
	} catch (e) {
		console.error("[dispatch-content-job] processor unreachable", e);
		await markVideoJobFailed({
			jobId: id,
			message:
				e instanceof Error ? e.message.slice(0, 500) : "processor_unreachable",
		});
		return;
	}

	if (res.status !== 202) {
		const text = await res.text().catch(() => "");
		await markVideoJobFailed({
			jobId: id,
			message: `processor_dispatch_${res.status}:${text.slice(0, 400)}`,
		});
		return;
	}

	await db
		.update(videoJobs)
		.set({
			status: "processing",
			progress: 10,
			currentStage: PIPELINE_STAGE.SCRIPT,
			updatedAt: new Date(),
		})
		.where(and(eq(videoJobs.id, id), eq(videoJobs.status, "dispatched")));
}
