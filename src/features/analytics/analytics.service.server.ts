import "@tanstack/react-start/server-only";

import { and, count, eq, gte, sql, sum } from "drizzle-orm";

import { getDb } from "@/db";
import { channels } from "@/db/schema/channels";
import { videoJobs } from "@/db/schema/video-jobs";

export type AnalyticsSummary = {
	totalCompleted: number;
	totalFailed: number;
	totalJobs: number;
	creditsUsedThisMonth: number;
	successRate: number;
	byChannel: {
		channelId: string;
		channelName: string;
		completed: number;
		failed: number;
	}[];
	last30Days: { date: string; count: number }[];
};

export async function getAnalyticsSummaryForUser(
	userId: string,
): Promise<AnalyticsSummary> {
	const db = getDb();

	const firstOfMonth = new Date();
	firstOfMonth.setUTCDate(1);
	firstOfMonth.setUTCHours(0, 0, 0, 0);

	const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

	// All-time totals + per-channel breakdown in one query
	const totalsRows = await db
		.select({
			channelId: videoJobs.channelId,
			channelName: channels.name,
			status: videoJobs.status,
			count: count(),
		})
		.from(videoJobs)
		.innerJoin(channels, eq(videoJobs.channelId, channels.id))
		.where(eq(videoJobs.userId, userId))
		.groupBy(videoJobs.channelId, channels.name, videoJobs.status);

	// Credits used this month (completed jobs only)
	const [creditsRow] = await db
		.select({ total: sum(videoJobs.costCredits) })
		.from(videoJobs)
		.where(
			and(
				eq(videoJobs.userId, userId),
				eq(videoJobs.status, "completed"),
				gte(videoJobs.createdAt, firstOfMonth),
			),
		);

	// Last 30 days — completed jobs per day.
	// Use DATE() (returns YYYY-MM-DD) rather than DATE_FORMAT so SELECT / GROUP BY /
	// ORDER BY all expand identically — TiDB strict mode rejects mismatched qualifiers.
	const jobDate = sql<string>`DATE(${videoJobs.createdAt})`;
	const dailyRows = await db
		.select({
			date: jobDate,
			count: count(),
		})
		.from(videoJobs)
		.where(
			and(
				eq(videoJobs.userId, userId),
				eq(videoJobs.status, "completed"),
				gte(videoJobs.createdAt, thirtyDaysAgo),
			),
		)
		.groupBy(jobDate)
		.orderBy(jobDate);

	// Aggregate totals
	let totalCompleted = 0;
	let totalFailed = 0;
	let totalJobs = 0;

	const channelMap = new Map<
		string,
		{ channelName: string; completed: number; failed: number }
	>();

	for (const row of totalsRows) {
		const n = Number(row.count);
		totalJobs += n;
		if (row.status === "completed") {
			totalCompleted += n;
		} else if (row.status === "failed") {
			totalFailed += n;
		}

		const existing = channelMap.get(row.channelId) ?? {
			channelName: row.channelName,
			completed: 0,
			failed: 0,
		};
		if (row.status === "completed") {
			existing.completed += n;
		} else if (row.status === "failed") {
			existing.failed += n;
		}
		channelMap.set(row.channelId, existing);
	}

	// Denominator is terminal jobs only — active jobs (queued/processing) are excluded
	// so the success rate doesn't fluctuate downward while a pipeline is in flight.
	const terminalJobs = totalCompleted + totalFailed;
	const successRate =
		terminalJobs > 0 ? Math.round((totalCompleted / terminalJobs) * 100) : 0;

	const byChannel = Array.from(channelMap.entries()).map(
		([channelId, data]) => ({ channelId, ...data }),
	);

	return {
		totalCompleted,
		totalFailed,
		totalJobs,
		creditsUsedThisMonth: Number(creditsRow?.total ?? 0),
		successRate,
		byChannel,
		last30Days: dailyRows.map((r) => ({
			date: r.date,
			count: Number(r.count),
		})),
	};
}
