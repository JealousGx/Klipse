import "@tanstack/react-start/server-only"

import { logger } from "@/lib/logger"
import { getGcpAccessToken } from "./gcp-auth.server"

/**
 * Cancels a running Cloud Run Job execution (`executions.cancel`) — used when a job has
 * been stuck in `processing` past the stall timeout, to actually stop the GPU billing
 * instead of just flipping the DB row to `failed`. Best-effort: logs and swallows
 * failures (the execution may have already finished/been GC'd) rather than throwing,
 * since the caller marks the job failed regardless.
 */
export async function cancelProcessorExecution(
	executionName: string,
): Promise<void> {
	const accessToken = await getGcpAccessToken()
	const url = `https://run.googleapis.com/v2/${executionName}:cancel`

	try {
		const res = await fetch(url, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({}),
			signal: AbortSignal.timeout(30_000),
		})

		if (!res.ok) {
			const text = await res.text().catch(() => "")
			logger.warn("processor_execution_cancel_failed", {
				executionName,
				status: res.status,
				body: text.slice(0, 400),
			})
			return
		}

		logger.info("processor_execution_cancelled", { executionName })
	} catch (err) {
		logger.warn("processor_execution_cancel_error", {
			executionName,
			error: err instanceof Error ? err.message : String(err),
		})
	}
}
