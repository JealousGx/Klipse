import { env } from "@/env";
import type { BugReportInput } from "@/features/feedback/post.functions";
import { logger } from "@/lib/logger";
import { getEnvironment } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

const SEVERITY_COLORS: Record<string, number> = {
	low: 0x3b82f6,
	medium: 0xf59e0b,
	high: 0xef4444,
	critical: 0x7f1d1d,
};

const SEVERITY_LABELS: Record<string, string> = {
	low: "Low",
	medium: "Medium",
	high: "High",
	critical: "Critical",
};

// ---------------------------------------------------------------------------
// submitBugReport
// ---------------------------------------------------------------------------

export async function submitBugReport(
	user: { id: string; name: string; email: string },
	data: BugReportInput,
): Promise<{ success: true } | { error: string }> {
	try {
		const { title, what, steps, expected, severity, page } = data;

		const userName = user.name;
		const userEmail = user.email;
		const userId = user.id;

		const fields = [{ name: "What happened", value: what, inline: false }];

		if (steps) {
			fields.push({
				name: "Steps to reproduce",
				value: steps,
				inline: false,
			});
		}

		if (expected) {
			fields.push({
				name: "Expected behavior",
				value: expected,
				inline: false,
			});
		}

		fields.push(
			{
				name: "Severity",
				value: SEVERITY_LABELS[severity] ?? severity,
				inline: true,
			},
			{ name: "Page", value: page || "Not specified", inline: true },
		);

		fields.push(
			{ name: "User", value: userName, inline: true },
			{ name: "Email", value: userEmail, inline: true },
			{ name: "User ID", value: `\`${userId}\``, inline: true },
		);

		const isProduction = getEnvironment() === "production";
		const envTag = isProduction ? "" : `[Staging] `;

		const embed = {
			title: `${envTag}Bug: ${title}`,
			color: SEVERITY_COLORS[severity] ?? 0x6b7280,
			fields,
			timestamp: new Date().toISOString(),
			footer: {
				text: `Klipse Bug Report${envTag ? ` • ${envTag.trim()}` : ""}`,
			},
		};

		const webhookRes = await fetch(env.DISCORD_BUG_REPORT_WEBHOOK_URL, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				username: "Klipse Bug Reporter",
				embeds: [embed],
			}),
		});

		if (!webhookRes.ok) {
			logger.error("[Discord Webhook] request failed", {
				status: webhookRes.status,
				body: await webhookRes.text(),
			});
			return {
				error: "Failed to submit bug report. Please try again later.",
			};
		}

		return { success: true };
	} catch (error) {
		logger.error("Error submitting bug report:", {
			error: error instanceof Error ? error.message : String(error),
		});
		return {
			error: "An unexpected error occurred. Please try again later.",
		};
	}
}
