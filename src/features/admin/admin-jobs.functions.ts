import { createServerFn } from "@tanstack/react-start"
import { getRequest } from "@tanstack/react-start/server"
import { z } from "zod"

import {
	cancelAdminJob,
	getJobStatusCounts,
	listAdminJobs,
} from "@/features/admin/admin-jobs.server"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AdminJobRow = {
	id: string
	userId: string
	userEmail: string
	channelName: string
	pipelineKind: string
	status: string
	progress: number
	currentStage: string | null
	costCredits: number
	errorMessage: string | null
	retryCount: number
	createdAt: Date
	updatedAt: Date
}

// ---------------------------------------------------------------------------
// listAdminJobsFn
// ---------------------------------------------------------------------------

const adminCursorSchema = z
	.object({
		createdAt: z.string().datetime(),
		id: z.string().trim().min(1),
	})
	.optional()

const listJobsInput = z.object({
	status: z
		.enum(["all", "queued", "dispatched", "processing", "completed", "failed"])
		.default("all"),
	limit: z.number().int().min(1).max(200).default(50),
	cursor: adminCursorSchema,
})

export type ListAdminJobsInput = z.infer<typeof listJobsInput>

export type ListAdminJobsResult =
	| {
			ok: true
			jobs: AdminJobRow[]
			nextCursor: { createdAt: string; id: string } | null
	  }
	| { ok: false; code: "unauthorized" }

export const listAdminJobsFn = createServerFn({ method: "POST" })
	.inputValidator((raw: unknown) => listJobsInput.parse(raw ?? {}))
	.handler(async ({ data }): Promise<ListAdminJobsResult> => {
		return listAdminJobs(getRequest(), data)
	})

// ---------------------------------------------------------------------------
// cancelAdminJobFn
// ---------------------------------------------------------------------------

export type CancelAdminJobResult =
	| { ok: true }
	| {
			ok: false
			code: "unauthorized" | "not_found" | "already_terminal"
	  }

export const cancelAdminJobFn = createServerFn({ method: "POST" })
	.inputValidator((raw: unknown) => z.object({ jobId: z.string() }).parse(raw))
	.handler(async ({ data }): Promise<CancelAdminJobResult> => {
		return cancelAdminJob(getRequest(), data.jobId)
	})

// ---------------------------------------------------------------------------
// getJobStatusCountsFn — quick summary for the system page
// ---------------------------------------------------------------------------

export type JobStatusCounts = {
	queued: number
	dispatched: number
	processing: number
	completed: number
	failed: number
	total: number
}

export type GetJobStatusCountsResult =
	| { ok: true; counts: JobStatusCounts }
	| { ok: false; code: "unauthorized" }

export const getJobStatusCountsFn = createServerFn({ method: "GET" }).handler(
	async (): Promise<GetJobStatusCountsResult> => {
		return getJobStatusCounts(getRequest())
	},
)
