import "@tanstack/react-start/server-only";

import { and, eq } from "drizzle-orm";
import { siteConfig } from "@/config/site";
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
import { brandEmailHtml, escapeHtml } from "@/lib/email/brand-layout";
import {
	FREE_TIER_RETENTION_HOURS,
	formatOutputRetentionDeadlineUtc,
	humanizeRetentionHours,
	PAID_TIER_RETENTION_HOURS,
} from "@/lib/format-output-retention";
import { expiringAssetRowId } from "@/lib/id";
import { logger } from "@/lib/logger";

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

	logger.info("asset_registered", { jobId, userId, plan, hours });

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
			`Your latest video for "${safeName}" is ready.`,
			"",
			`This destination is set to ask you before anything goes live. Open Jobs in Klipse to approve or reject publishing:`,
			dashboardUrl,
			"",
			`We keep this video for ${retentionPhrase} after it’s ready. It’s scheduled for removal on ${deadlineUtc} (UTC). After that, you’d need to generate again before we can publish.`,
			"",
			`— Klipse`,
		].join("\n");

		const emailContent = `
<h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#111827;text-align:center;line-height:1.3;">
  Your video is ready
</h2>
<p style="margin:0 0 6px;font-size:15px;line-height:1.6;color:#6b7280;text-align:center;">
  <strong style="color:#111827;">${escapeHtml(safeName)}</strong>
</p>
<p style="margin:0 0 28px;font-size:14px;line-height:1.55;color:#6b7280;text-align:center;">
  You&rsquo;ve chosen to review before publishing. Approve or reject below.
</p>
<p style="text-align:center;margin:0 0 28px;">
  <a href="${dashboardUrl}"
     style="display:inline-block;background:#E07B30;color:#ffffff;text-decoration:none;padding:13px 28px;border-radius:10px;font-weight:600;font-size:15px;line-height:1;">
    Review &amp; publish
  </a>
</p>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%"
       style="background-color:#fffbeb;border:1px solid #fde68a;border-radius:10px;margin:0 0 24px;">
  <tr>
    <td style="padding:16px 18px;">
      <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:0.05em;">
        Storage window
      </p>
      <p style="margin:0;font-size:14px;line-height:1.55;color:#78350f;">
        Videos are kept for <strong>${escapeHtml(retentionPhrase)}</strong>.
        This one is scheduled for removal after <strong>${escapeHtml(deadlineUtc)}</strong>.
        Approve or reject before then so you don&rsquo;t lose access.
      </p>
    </td>
  </tr>
</table>
<p style="margin:0;font-size:13px;line-height:1.5;color:#9ca3af;text-align:center;">
  If you didn&rsquo;t request this, you can safely ignore this email.
</p>
`.trim();

		await sendEmail({
			to: u.email,
			from: getTransactionEmailFrom(),
			subject: `${siteConfig.name} · Your video is ready — review by ${deadlineShort} · ${safeName}`,
			text: textBody,
			html: brandEmailHtml({
				preheader: `Your latest video for ${safeName} is ready. Review by ${deadlineShort}.`,
				content: emailContent,
			}),
		});

		logger.info("approval_pending_email_sent", {
			jobId,
			channelName: safeName,
		});
	}

	await dispatchPlatformPublishAfterRender({
		jobId,
		userId,
		channel,
		plan,
	});
}
