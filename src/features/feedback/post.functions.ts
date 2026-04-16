import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import { env } from "@/env";
import { auth } from "@/lib/auth";
import { getEnvironment } from "@/lib/utils";

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

const bugReportSchema = z.object({
	title: z.string().min(5, "Title must be at least 5 characters").max(100),
	what: z
		.string()
		.min(10, "Please describe what happened (min 10 chars)")
		.max(1000),
	steps: z.string().max(1000).optional(),
	expected: z.string().max(500).optional(),
	severity: z.enum(["low", "medium", "high", "critical"]),
	page: z.string().max(200).optional(),
});

export const submitBug = createServerFn({ method: "POST" })
	.inputValidator((raw: unknown) => bugReportSchema.parse(raw))
	.handler(async ({ data }) => {
		try {
			const { title, what, steps, expected, severity, page } = data;

			const request = getRequest();
			const _userInfo = await auth.api.getSession({
				headers: request.headers,
			});

			const userName = _userInfo?.user.name ?? "Anonymous";
			const userEmail = _userInfo?.user.email ?? "N/A";
			const userId = _userInfo?.user.id ?? "N/A";

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
				console.error(
					"[Discord Webhook]",
					webhookRes.status,
					await webhookRes.text(),
				);
				return {
					error: "Failed to submit bug report. Please try again later.",
				};
			}

			return {
				success: true,
			};
		} catch (error) {
			console.error("Error submitting bug report:", error);
			return {
				error: "An unexpected error occurred. Please try again later.",
			};
		}
	});
