import { desc, eq, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { channels } from "@/db/schema/channels";
import { users } from "@/db/schema/users";
import { videoJobs } from "@/db/schema/video-jobs";
import { requireAdmin } from "@/features/admin/admin.guard.server";
import { logger } from "@/lib/logger";

import type {
	AdminJobRow,
	JobStatusCounts,
	ListAdminJobsInput,
} from "@/features/admin/admin-jobs.functions";

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

const ACTIVE_STATUSES = ["queued", "dispatched", "processing"] as const;

// ---------------------------------------------------------------------------
// listAdminJobs
// ---------------------------------------------------------------------------

export async function listAdminJobs(
	request: Request,
	data: ListAdminJobsInput,
): Promise<
	| { ok: true; jobs: AdminJobRow[]; total: number }
	| { ok: false; code: "unauthorized" }
> {
	try {
		await requireAdmin(request);
	} catch {
		return { ok: false, code: "unauthorized" };
	}

	const db = getDb();
	const whereClause =
		data.status === "all"
			? undefined
			: eq(videoJobs.status, data.status as (typeof ACTIVE_STATUSES)[number]);

	const [countRow] = await db
		.select({ count: sql<number>`COUNT(*)` })
		.from(videoJobs)
		.where(whereClause);

	const rows = await db
		.select({
			id: videoJobs.id,
			userId: videoJobs.userId,
			userEmail: users.email,
			channelName: channels.name,
			pipelineKind: videoJobs.pipelineKind,
			status: videoJobs.status,
			progress: videoJobs.progress,
			currentStage: videoJobs.currentStage,
			costCredits: videoJobs.costCredits,
			errorMessage: videoJobs.errorMessage,
			retryCount: videoJobs.retryCount,
			createdAt: videoJobs.createdAt,
			updatedAt: videoJobs.updatedAt,
		})
		.from(videoJobs)
		.leftJoin(users, eq(videoJobs.userId, users.id))
		.leftJoin(channels, eq(videoJobs.channelId, channels.id))
		.where(whereClause)
		.orderBy(desc(videoJobs.createdAt))
		.limit(data.limit)
		.offset(data.offset);

	const jobs: AdminJobRow[] = rows.map((r) => ({
		id: r.id,
		userId: r.userId,
		userEmail: r.userEmail ?? "(deleted)",
		channelName: r.channelName ?? "(deleted)",
		pipelineKind: r.pipelineKind,
		status: r.status,
		progress: r.progress,
		currentStage: r.currentStage ?? null,
		costCredits: r.costCredits,
		errorMessage: r.errorMessage ?? null,
		retryCount: r.retryCount,
		createdAt: r.createdAt,
		updatedAt: r.updatedAt,
	}));

	return { ok: true, jobs, total: Number(countRow?.count ?? 0) };
}

// ---------------------------------------------------------------------------
// cancelAdminJob
// ---------------------------------------------------------------------------

export async function cancelAdminJob(
	request: Request,
	jobId: string,
): Promise<
	| { ok: true }
	| { ok: false; code: "unauthorized" | "not_found" | "already_terminal" }
> {
	let adminInfo: { userId: string; email: string };
	try {
		adminInfo = await requireAdmin(request);
	} catch {
		return { ok: false, code: "unauthorized" };
	}

	const db = getDb();
	const [job] = await db
		.select({ id: videoJobs.id, status: videoJobs.status })
		.from(videoJobs)
		.where(eq(videoJobs.id, jobId))
		.limit(1);

	if (!job) return { ok: false, code: "not_found" };

	const isActive = (ACTIVE_STATUSES as readonly string[]).includes(job.status);
	if (!isActive) return { ok: false, code: "already_terminal" };

	await db
		.update(videoJobs)
		.set({
			status: "failed",
			errorMessage: `Cancelled by admin (${adminInfo.email})`,
			updatedAt: new Date(),
		})
		.where(eq(videoJobs.id, jobId));

	logger.info("admin_job_cancelled", { jobId, adminEmail: adminInfo.email });

	return { ok: true };
}

// ---------------------------------------------------------------------------
// getJobStatusCounts
// ---------------------------------------------------------------------------

export async function getJobStatusCounts(
	request: Request,
): Promise<
	{ ok: true; counts: JobStatusCounts } | { ok: false; code: "unauthorized" }
> {
	try {
		await requireAdmin(request);
	} catch {
		return { ok: false, code: "unauthorized" };
	}

	const db = getDb();
	const rows = await db
		.select({
			status: videoJobs.status,
			count: sql<number>`COUNT(*)`,
		})
		.from(videoJobs)
		.groupBy(videoJobs.status);

	const counts: JobStatusCounts = {
		queued: 0,
		dispatched: 0,
		processing: 0,
		completed: 0,
		failed: 0,
		total: 0,
	};

	for (const r of rows) {
		const n = Number(r.count);
		counts.total += n;
		if (r.status in counts) {
			(counts as Record<string, number>)[r.status] = n;
		}
	}

	return { ok: true, counts };
}
