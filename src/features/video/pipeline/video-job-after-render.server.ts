import "@tanstack/react-start/server-only";

import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { expiringAssets } from "@/db/schema/expiring-assets";
import { users } from "@/db/schema/users";
import { videoJobs } from "@/db/schema/video-jobs";

import { env } from "@/env";

import { planAllowsPaidPublishingConnections } from "@/features/billing/tier-config";
import { getChannelForUser } from "@/features/channels/channels.service.server";
import { dispatchPlatformPublishAfterRender } from "@/features/publishing/publish-dispatch.server";
import type { MeResponse } from "@/features/user/types/me";
import { getTransactionEmailFrom, sendEmail } from "@/lib/email";
import {
	FREE_TIER_RETENTION_HOURS,
	formatOutputRetentionDeadlineUtc,
	humanizeRetentionHours,
	PAID_TIER_RETENTION_HOURS,
} from "@/lib/format-output-retention";
import { expiringAssetRowId } from "@/lib/id";
import { WorkerEnqueueFailedError } from "@/lib/worker/enqueue.server";

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

/**
 * After the assembled video lands in R2: register TTL for purge (FEATURE_DOC §2.7–2.8) and
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
		.select({ id: expiringAssets.id })
		.from(expiringAssets)
		.where(
			and(
				eq(expiringAssets.videoJobId, jobId),
				eq(expiringAssets.kind, "output"),
			),
		)
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

	await db.insert(expiringAssets).values({
		id: expiringAssetRowId(),
		userId,
		logicalKey: input.logicalKey.trim(),
		videoJobId: jobId,
		kind: "output",
		expiresAt,
	});

	const channel = await getChannelForUser(userId, input.channelId.trim());
	if (!channel) {
		return;
	}

	if (planAllowsPaidPublishingConnections(plan) && !channel.config.auto_post) {
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
		const safeName = channel.name.trim() || "your destination";
		const retentionPhrase = humanizeRetentionHours(hours);
		const deadlineUtc = formatOutputRetentionDeadlineUtc(expiresAt, "en-US");
		const deadlineShort = expiresAt.toLocaleDateString("en-US", {
			timeZone: "UTC",
			month: "short",
			day: "numeric",
			year: "numeric",
		});

		const textBody = [
			`Your latest video for “${safeName}” is ready.`,
			"",
			`This destination is set to ask you before anything goes live. Open Jobs in Klipse to approve or reject publishing:`,
			dashboardUrl,
			"",
			`We keep this video for ${retentionPhrase} after it’s ready. It’s scheduled for removal on ${deadlineUtc} (UTC). After that, you’d need to generate again before we can publish.`,
			"",
			`— Klipse`,
		].join("\n");

		const htmlBody = `
<p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:#111827;">Your latest video for <strong>${escapeHtml(safeName)}</strong> is ready.</p>
<p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:#374151;">You’ve chosen to confirm before anything is published. Take a minute in <strong>Jobs</strong> to approve or reject.</p>
<p style="margin:0 0 24px;">
  <a href="${dashboardUrl}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;font-size:15px;">Open Jobs &amp; review</a>
</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:520px;border-collapse:collapse;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;margin:0 0 20px;">
  <tr><td style="padding:16px 18px;">
    <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#92400e;text-transform:uppercase;letter-spacing:0.04em;">Storage window</p>
    <p style="margin:0;font-size:14px;line-height:1.55;color:#78350f;">Videos are kept for <strong>${escapeHtml(retentionPhrase)}</strong>. This one is scheduled for removal after <strong>${escapeHtml(deadlineUtc)}</strong>. Approve or reject before then so you don’t lose access.</p>
  </td></tr>
</table>
<p style="margin:0;font-size:13px;line-height:1.5;color:#6b7280;">If you didn’t request this, you can ignore this email.</p>
`.trim();

		await sendEmail({
			to: u.email,
			from: getTransactionEmailFrom(),
			subject: `Your video is ready — review by ${deadlineShort} · ${safeName}`,
			text: textBody,
			html: htmlBody,
		});
	}

	try {
		await dispatchPlatformPublishAfterRender({
			jobId,
			userId,
			channel,
			plan,
		});
	} catch (e) {
		if (e instanceof WorkerEnqueueFailedError) {
			// Record the failure on the job so the user can see it and retry manually.
			// The job stays `completed` (render succeeded); only the publish enqueue failed.
			console.error("[after-render] publish enqueue failed", jobId, e);
			await db
				.update(videoJobs)
				.set({
					publishLastError: "publish_enqueue_failed",
					updatedAt: new Date(),
				})
				.where(and(eq(videoJobs.id, jobId), eq(videoJobs.userId, userId)));
			return;
		}
		throw e;
	}
}
