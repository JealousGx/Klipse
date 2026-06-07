import type {
	ProcessorCompletePayload,
	ProcessorJobSpec,
	ProcessorKeyFailurePayload,
	ProcessorKeyFailureProvider,
	ProcessorProgressPayload,
} from "@klipse/video-assembly-shared"

import { logger } from "./logger"
import { NonRetriableError, withRetries } from "./retry"

const PROGRESS_ATTEMPTS = 3
const FAILURE_ATTEMPTS = 5
const COMPLETE_ATTEMPTS = 8

async function postCallback(
	baseUrl: string,
	secret: string,
	path: string,
	body: unknown,
	attempts: number,
): Promise<void> {
	await withRetries(`callback_${path}`, attempts, async () => {
		const res = await fetch(`${baseUrl}${path}`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${secret}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(30_000),
		})
		if (!res.ok) {
			const t = await res.text().catch(() => "")
			const msg = `callback_${res.status}:${t.slice(0, 300)}`
			// 4xx = deterministic app-level rejection — retrying won't change outcome.
			if (res.status >= 400 && res.status < 500) {
				throw new NonRetriableError(msg)
			}
			throw new Error(msg)
		}
	})
}

export async function reportProgress(
	spec: ProcessorJobSpec,
	stage: ProcessorProgressPayload["stage"],
	progress: number,
): Promise<void> {
	const body: ProcessorProgressPayload = { jobId: spec.jobId, stage, progress }
	await postCallback(
		spec.callbackBaseUrl,
		spec.callbackSecret,
		"/api/internal/processor/progress",
		body,
		PROGRESS_ATTEMPTS,
	).catch((e) =>
		logger.warn("callbacks_progress_failed", {
			jobId: spec.jobId,
			stage,
			error: e instanceof Error ? e.message : String(e),
		}),
	)
}

export async function reportKeyFailure(
	spec: ProcessorJobSpec,
	provider: ProcessorKeyFailureProvider,
	keyId: string,
	httpStatus: number,
	bodySnippet: string,
	retryAfterHeader: string | null,
): Promise<void> {
	const body: ProcessorKeyFailurePayload = {
		jobId: spec.jobId,
		provider,
		keyId,
		httpStatus,
		bodySnippet,
		retryAfterHeader,
	}
	await postCallback(
		spec.callbackBaseUrl,
		spec.callbackSecret,
		"/api/internal/processor/key-failure",
		body,
		FAILURE_ATTEMPTS,
	).catch((e) =>
		logger.warn("callbacks_key_failure_failed", {
			jobId: spec.jobId,
			provider,
			error: e instanceof Error ? e.message : String(e),
		}),
	)
}

export async function reportComplete(
	spec: ProcessorJobSpec,
	status: "completed" | "failed",
	error?: string,
	scriptText?: string,
	title?: string,
	description?: string,
	tags?: string[],
	durationSec?: number,
): Promise<void> {
	const body: ProcessorCompletePayload = {
		jobId: spec.jobId,
		userId: spec.userId,
		status,
		error,
		scriptText,
		title,
		description,
		tags,
		durationSec,
	}
	await postCallback(
		spec.callbackBaseUrl,
		spec.callbackSecret,
		"/api/internal/video-processor/assembly-complete",
		body,
		COMPLETE_ATTEMPTS,
	)
}
