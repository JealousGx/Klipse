import "@tanstack/react-start/server-only"

import { env } from "@/env"
import { getGcpAccessToken } from "./gcp-auth.server"

export function isProcessorJobConfigured(): boolean {
	const publicBase = (env.APP_PUBLIC_URL ?? env.SERVER_URL)?.trim()
	return Boolean(
		env.GCP_PROJECT_ID?.trim() &&
			env.GCP_RUN_JOB_NAME?.trim() &&
			env.GCP_SERVICE_ACCOUNT_EMAIL?.trim() &&
			env.GCP_SERVICE_ACCOUNT_PRIVATE_KEY?.trim() &&
			env.VIDEO_PROCESSOR_WEBHOOK_SECRET?.trim() &&
			publicBase,
	)
}

export type RunProcessorJobResult = {
	/**
	 * Cloud Run Execution resource name (`projects/{p}/locations/{l}/jobs/{j}/executions/{e}`),
	 * read from the `jobs.run` long-running Operation's `metadata.name` — RunJob's
	 * `operation_info.metadata_type` is `Execution`, so this is populated synchronously in
	 * the initial response, not just once the execution finishes. `null` if GCP's response
	 * didn't include it (defensive — the caller should still proceed; this is only needed
	 * later to cancel a stuck execution, not for correctness of the dispatch itself).
	 */
	executionName: string | null
}

/**
 * Triggers a Cloud Run Job execution for `jobId` via the Cloud Run Admin API
 * (`projects.locations.jobs.run`). Only `jobId` is passed as a container env override —
 * the Job container fetches the rest of the spec itself from
 * `/api/internal/processor/job-spec` (provider keys/prompts don't belong in a GCP API
 * call payload, and Job env-var overrides have size limits). Returns once GCP has
 * accepted the execution request (a long-running operation on GCP's side) — does NOT
 * wait for the job itself to finish, matching the old Service's fast-202 dispatch intent.
 */
export async function runProcessorJob(
	jobId: string,
): Promise<RunProcessorJobResult> {
	const project = env.GCP_PROJECT_ID?.trim()
	const region = env.GCP_RUN_REGION?.trim()
	const job = env.GCP_RUN_JOB_NAME?.trim()
	if (!project || !region || !job) {
		throw new Error(
			"GCP_PROJECT_ID, GCP_RUN_REGION, and GCP_RUN_JOB_NAME required",
		)
	}

	const accessToken = await getGcpAccessToken()
	const url = `https://run.googleapis.com/v2/projects/${project}/locations/${region}/jobs/${job}:run`

	const res = await fetch(url, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${accessToken}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			overrides: {
				containerOverrides: [
					{ env: [{ name: "KLIPSE_JOB_ID", value: jobId }] },
				],
				taskCount: 1,
			},
		}),
		signal: AbortSignal.timeout(30_000),
	})

	if (!res.ok) {
		const text = await res.text().catch(() => "")
		throw new Error(`processor_job_run_failed:${res.status}:${text.slice(0, 400)}`)
	}

	const operation = (await res.json().catch(() => null)) as {
		metadata?: { name?: string }
	} | null

	return { executionName: operation?.metadata?.name ?? null }
}
