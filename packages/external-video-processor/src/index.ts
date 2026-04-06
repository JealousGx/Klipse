import { execFile } from "node:child_process";
import { readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { serve } from "@hono/node-server";
import {
	integrationPlaceholderFfmpegArgs,
	type VideoProcessorHandoffPayload,
} from "@klipse/video-assembly-shared";
import { Hono } from "hono";

const execFileAsync = promisify(execFile);

function ffmpegBinary(): string {
	return process.env.FFMPEG_PATH?.trim() || "ffmpeg";
}

function isHandoffPayload(x: unknown): x is VideoProcessorHandoffPayload {
	if (!x || typeof x !== "object") {
		return false;
	}
	const o = x as Record<string, unknown>;
	return (
		typeof o.jobId === "string" &&
		o.jobId.length > 0 &&
		typeof o.userId === "string" &&
		o.userId.length > 0 &&
		typeof o.presignedPutUrl === "string" &&
		o.presignedPutUrl.startsWith("http") &&
		typeof o.contentType === "string" &&
		typeof o.completeWebhookUrl === "string" &&
		o.completeWebhookUrl.startsWith("http")
	);
}

async function notifyApp(
	completeWebhookUrl: string,
	body: {
		jobId: string;
		userId: string;
		status: "completed" | "failed";
		error?: string;
	},
): Promise<void> {
	const secret = process.env.VIDEO_PROCESSOR_WEBHOOK_SECRET?.trim();
	if (!secret) {
		throw new Error("VIDEO_PROCESSOR_WEBHOOK_SECRET is not set");
	}
	const res = await fetch(completeWebhookUrl, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${secret}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(body),
		signal: AbortSignal.timeout(60_000),
	});
	if (!res.ok) {
		const t = await res.text().catch(() => "");
		throw new Error(`webhook_${res.status}:${t.slice(0, 300)}`);
	}
}

async function runPipeline(
	payload: VideoProcessorHandoffPayload,
): Promise<void> {
	const tmpOut = join(tmpdir(), `klipse-assembly-${payload.jobId}.mp4`);
	try {
		await execFileAsync(
			ffmpegBinary(),
			integrationPlaceholderFfmpegArgs(tmpOut),
			{
				timeout: 120_000,
				maxBuffer: 10 * 1024 * 1024,
			},
		);

		const buf = await readFile(tmpOut);
		const put = await fetch(payload.presignedPutUrl, {
			method: "PUT",
			headers: {
				"Content-Type": payload.contentType,
			},
			body: buf,
			signal: AbortSignal.timeout(120_000),
		});

		if (!put.ok) {
			const errText = await put.text().catch(() => "");
			await notifyApp(payload.completeWebhookUrl, {
				jobId: payload.jobId,
				userId: payload.userId,
				status: "failed",
				error: `r2_put_${put.status}:${errText.slice(0, 500)}`,
			});
			return;
		}

		await notifyApp(payload.completeWebhookUrl, {
			jobId: payload.jobId,
			userId: payload.userId,
			status: "completed",
		});
	} catch (e) {
		const message =
			e instanceof Error ? e.message.slice(0, 4000) : "ffmpeg_or_upload_failed";
		try {
			await notifyApp(payload.completeWebhookUrl, {
				jobId: payload.jobId,
				userId: payload.userId,
				status: "failed",
				error: message,
			});
		} catch (notifyErr) {
			console.error(
				"[external-video-processor] webhook after failure failed",
				notifyErr,
			);
		}
	} finally {
		try {
			await unlink(tmpOut);
		} catch {
			// ignore
		}
	}
}

const app = new Hono();

app.get("/health", (c) => c.text("ok"));

app.post("/v1/process", async (c) => {
	const expected = process.env.VIDEO_PROCESSOR_CLIENT_SECRET?.trim();
	if (!expected) {
		return c.json({ error: "server_misconfigured" }, 503);
	}
	const auth = c.req.header("authorization");
	if (auth !== `Bearer ${expected}`) {
		return c.json({ error: "unauthorized" }, 401);
	}

	let raw: unknown;
	try {
		raw = await c.req.json();
	} catch {
		return c.json({ error: "invalid_json" }, 400);
	}

	if (!isHandoffPayload(raw)) {
		return c.json({ error: "invalid_body" }, 400);
	}

	void runPipeline(raw).catch((e) => {
		console.error("[external-video-processor] pipeline error", e);
	});

	return c.json({ accepted: true as const }, 202);
});

const port = Number(process.env.PORT) || 8790;
serve({ fetch: app.fetch, port }, (info) => {
	console.log(`[external-video-processor] listening on port ${info.port}`);
});
