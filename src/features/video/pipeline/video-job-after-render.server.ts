import "@tanstack/react-start/server-only";

import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { storedFiles } from "@/db/schema/stored-files";
import { users } from "@/db/schema/users";
import { videoJobs } from "@/db/schema/video-jobs";

import { env } from "@/env";

import { planAllowsPaidPublishingConnections } from "@/features/billing/tier-config";
import { getChannelForUser } from "@/features/channels/channels.service.server";
import type { MeResponse } from "@/features/user/types/me";

import { getTransactionEmailFrom, sendEmail } from "@/lib/email";
import { storedFileRowId } from "@/lib/id";

export const FREE_TIER_RETENTION_HOURS = 24;
export const PAID_TIER_RETENTION_HOURS = 24 * 7;

/**
 * After a final render lands in R2: register TTL for purge (FEATURE_DOC §2.7–2.8) and
 * optionally gate publishing behind manual approval (§2.14).
 */
export async function runAfterVideoRenderComplete(input: {
	jobId: string;
	userId: string;
	channelId: string;
	logicalKey: string;
}): Promise<void> {
	const db = getDb();
	const jobId = input.jobId.trim();
	const userId = input.userId.trim();

	const [existing] = await db
		.select({ id: storedFiles.id })
		.from(storedFiles)
		.where(eq(storedFiles.videoJobId, jobId))
		.limit(1);
	if (existing) {
		return;
	}

	const [u] = await db
		.select({ plan: users.plan, email: users.email })
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);
	if (!u) {
		return;
	}

	const plan = u.plan as MeResponse["plan"];
	const hours =
		plan === "free" ? FREE_TIER_RETENTION_HOURS : PAID_TIER_RETENTION_HOURS;
	const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);

	await db.insert(storedFiles).values({
		id: storedFileRowId(),
		userId,
		logicalKey: input.logicalKey.trim(),
		videoJobId: jobId,
		expiresAt,
	});

	const channel = await getChannelForUser(userId, input.channelId.trim());
	if (!channel) {
		return;
	}

	if (
		planAllowsPaidPublishingConnections(plan) &&
		channel.config.require_approval
	) {
		await db
			.update(videoJobs)
			.set({
				publishApprovalStatus: "pending",
				updatedAt: new Date(),
			})
			.where(and(eq(videoJobs.id, jobId), eq(videoJobs.userId, userId)));

		const base =
			env.SERVER_URL?.replace(/\/$/, "") ||
			env.VITE_APP_URL?.replace(/\/$/, "") ||
			"";
		const dashboardUrl = `${base}/dashboard/jobs`;

		await sendEmail({
			to: u.email,
			from: getTransactionEmailFrom(),
			subject: `Review before publish: ${channel.name}`,
			text: `Your video for “${channel.name}” is ready. Approve or reject publishing in the dashboard: ${dashboardUrl}`,
			html: `<p>Your video for <strong>${channel.name}</strong> is ready.</p><p><a href="${dashboardUrl}">Open Jobs</a> to approve or reject publishing.</p>`,
		});
	}
}
