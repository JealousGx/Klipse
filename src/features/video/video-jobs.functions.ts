import { createServerFn } from "@tanstack/react-start"
import { getRequest } from "@tanstack/react-start/server"
import { z } from "zod"

import { auth } from "@/lib/auth"

import { retryFailedJobForUser } from "./retry-failed-job.server"
import { retryPublishForUser } from "./retry-publish.server"
import {
	LIST_JOBS_DEFAULT_PAGE_SIZE,
	MAX_MANUAL_RETRIES,
	MAX_PUBLISH_RETRIES,
} from "./video-job-constants"
import type { VideoJobListRow } from "./video-job-list.types"
import {
	listVideoJobsForUser,
	setPublishApprovalForUser,
} from "./video-jobs.service.server"

// Serialized cursor — ISO string for createdAt so it survives JSON round-trip.
const listJobsCursorSchema = z.object({
	createdAt: z.iso.datetime(),
	id: z.string().trim().min(1),
})

const listJobsSchema = z.object({
	cursor: listJobsCursorSchema.optional(),
	pageSize: z
		.number()
		.int()
		.min(1)
		.max(50)
		.default(LIST_JOBS_DEFAULT_PAGE_SIZE),
})

export type ListJobsResult =
	| {
			ok: true
			jobs: VideoJobListRow[]
			nextCursor: { createdAt: string; id: string } | null
	  }
	| { ok: false; code: "unauthorized" }

export const listVideoJobsFn = createServerFn({ method: "GET" })
	.inputValidator((raw: unknown) => listJobsSchema.parse(raw))
	.handler(async ({ data }): Promise<ListJobsResult> => {
		const request = getRequest()
		const session = await auth.api.getSession({ headers: request.headers })
		if (!session?.user) {
			return { ok: false, code: "unauthorized" }
		}
		const cursor = data.cursor
			? { createdAt: new Date(data.cursor.createdAt), id: data.cursor.id }
			: undefined
		const result = await listVideoJobsForUser(
			session.user.id,
			cursor,
			data.pageSize,
		)
		return {
			ok: true,
			jobs: result.jobs,
			nextCursor: result.nextCursor
				? {
						createdAt: result.nextCursor.createdAt.toISOString(),
						id: result.nextCursor.id,
					}
				: null,
		}
	})

const tiktokDisclosureSchema = z.object({
	enabled: z.boolean(),
	brandOrganic: z.boolean(),
	brandedContent: z.boolean(),
})

const publishSettingsSchema = z.object({
	privacyLevel: z.string().trim().min(1).max(64).optional(),
	tiktokDisclosure: tiktokDisclosureSchema.optional(),
})

const publishApprovalSchema = z.object({
	jobId: z.string().trim().min(1).max(64),
	decision: z.enum(["approved", "rejected"]),
	/** User-edited caption set during pre-publish review. Stored on the job and used by the platform publish function. */
	captionOverride: z.string().trim().max(5000).optional(),
	/** User-selected publish settings (privacy level, TikTok commercial content disclosure). */
	publishSettings: publishSettingsSchema.optional(),
})

export type PublishVideoJobApprovalResult =
	| { ok: true }
	| { ok: false; code: "unauthorized" }
	| { ok: false; code: "not_found" | "invalid_state" | "terms_not_confirmed" }

export const publishVideoJobApprovalFn = createServerFn({ method: "POST" })
	.inputValidator((raw: unknown) => publishApprovalSchema.parse(raw))
	.handler(async ({ data }): Promise<PublishVideoJobApprovalResult> => {
		const request = getRequest()
		const session = await auth.api.getSession({ headers: request.headers })
		if (!session?.user) {
			return { ok: false, code: "unauthorized" }
		}
		const result = await setPublishApprovalForUser({
			userId: session.user.id,
			jobId: data.jobId,
			decision: data.decision,
			captionOverride: data.captionOverride,
			publishSettings: data.publishSettings,
		})
		if (!result.ok) {
			return { ok: false, code: result.code }
		}
		return { ok: true }
	})

const retryJobSchema = z.object({
	jobId: z.string().trim().min(1).max(64),
})

export type RetryVideoJobResult =
	| { ok: true }
	| { ok: false; code: "unauthorized" }
	| { ok: false; code: "not_found" | "not_failed" | "max_retries" }

export const retryVideoJobFn = createServerFn({ method: "POST" })
	.inputValidator((raw: unknown) => retryJobSchema.parse(raw))
	.handler(async ({ data }): Promise<RetryVideoJobResult> => {
		const request = getRequest()
		const session = await auth.api.getSession({ headers: request.headers })
		if (!session?.user) {
			return { ok: false, code: "unauthorized" }
		}
		const result = await retryFailedJobForUser({
			userId: session.user.id,
			jobId: data.jobId,
		})
		if (!result.ok) {
			return { ok: false, code: result.code }
		}
		return { ok: true }
	})

// ---------------------------------------------------------------------------
// retryPublishFn — re-trigger platform publish after token reconnect
// ---------------------------------------------------------------------------

const retryPublishSchema = z.object({
	jobId: z.string().trim().min(1).max(64),
	platform: z.enum(["youtube", "tiktok", "instagram"]),
})

export type RetryPublishResult =
	| { ok: true }
	| {
			ok: false
			code:
				| "unauthorized"
				| "not_found"
				| "max_retries"
				| "already_published"
				| "not_ready"
				| "failed"
	  }

export const retryPublishFn = createServerFn({ method: "POST" })
	.inputValidator((raw: unknown) => retryPublishSchema.parse(raw))
	.handler(async ({ data }): Promise<RetryPublishResult> => {
		const request = getRequest()
		const session = await auth.api.getSession({ headers: request.headers })
		if (!session?.user) {
			return { ok: false, code: "unauthorized" }
		}
		const result = await retryPublishForUser({
			jobId: data.jobId,
			userId: session.user.id,
			platform: data.platform,
		})
		if (!result.ok) {
			return { ok: false, code: result.code }
		}
		return { ok: true }
	})

export { MAX_MANUAL_RETRIES, MAX_PUBLISH_RETRIES }
