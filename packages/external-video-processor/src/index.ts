import { serve } from "@hono/node-server"
import { initSentry } from "./sentry"
import { logger } from "./utils/logger"

// Init Sentry before anything else so it catches startup errors too
initSentry()

import type {
	ProcessorJobSpec,
	VideoProcessorHandoffPayload,
} from "@klipse/video-assembly-shared"
import { Hono } from "hono"

import {
	enqueueAssemblyJob,
	isAssemblyJobKnown,
} from "./pipeline/assembly-runner"
import { enqueueSpecJob, isSpecJobKnown } from "./pipeline/runner"

const app = new Hono()

function clientSecret(): string {
	return process.env.VIDEO_PROCESSOR_CLIENT_SECRET?.trim() ?? ""
}

function webhookSecret(): string {
	return process.env.VIDEO_PROCESSOR_WEBHOOK_SECRET?.trim() ?? ""
}

function isAuthorized(authHeader: string | undefined): boolean {
	const secret = clientSecret()
	return Boolean(secret) && authHeader === `Bearer ${secret}`
}

function isHandoffPayload(x: unknown): x is VideoProcessorHandoffPayload {
	if (!x || typeof x !== "object") return false
	const o = x as Record<string, unknown>
	return (
		typeof o.jobId === "string" &&
		o.jobId.length > 0 &&
		typeof o.userId === "string" &&
		o.userId.length > 0 &&
		typeof o.presignedPutUrl === "string" &&
		o.presignedPutUrl.startsWith("http") &&
		typeof o.contentType === "string" &&
		typeof o.completeWebhookUrl === "string" &&
		o.completeWebhookUrl.startsWith("http") &&
		typeof o.freeTierWatermark === "boolean" &&
		typeof o.watermarkLabel === "string" &&
		o.watermarkLabel.length > 0
	)
}

function isProcessorJobSpec(x: unknown): x is ProcessorJobSpec {
	if (!x || typeof x !== "object") return false
	const o = x as Record<string, unknown>

	const urls = o.presignedUrls as Record<string, unknown> | undefined
	const keys = o.providerKeys as Record<string, unknown> | undefined

	return (
		// Core identity
		typeof o.jobId === "string" &&
		o.jobId.length > 0 &&
		typeof o.userId === "string" &&
		o.userId.length > 0 &&
		typeof o.channelId === "string" &&
		o.channelId.length > 0 &&
		// Script prompts
		typeof o.scriptSystemPrompt === "string" &&
		typeof o.scriptUserPrompt === "string" &&
		// Model config
		Array.isArray(o.openrouterScriptModels) &&
		typeof o.ttsVoice === "string" &&
		// Video config
		typeof o.targetDuration === "number" &&
		o.targetDuration > 0 &&
		(o.aspectRatio === "16:9" ||
			o.aspectRatio === "9:16" ||
			o.aspectRatio === "1:1") &&
		typeof o.freeTierWatermark === "boolean" &&
		typeof o.watermarkLabel === "string" &&
		// Callback
		typeof o.callbackBaseUrl === "string" &&
		(o.callbackBaseUrl as string).startsWith("http") &&
		typeof o.callbackSecret === "string" &&
		o.callbackSecret.length > 0 &&
		// presignedUrls — only the final video upload URL is required
		urls !== undefined &&
		typeof urls.outputVideo === "string" &&
		urls.outputVideo.length > 0 &&
		// providerKeys — require all six arrays to be present
		keys !== undefined &&
		Array.isArray(keys.openrouter) &&
		Array.isArray(keys.gemini) &&
		Array.isArray(keys.googleTts) &&
		Array.isArray(keys.replicate) &&
		Array.isArray(keys.unrealSpeech) &&
		Array.isArray(keys.elevenlabs)
	)
}

app.get("/health", (c) => c.text("ok"))

/** Assembly-only pipeline (video_assemble_v1): FFmpeg + presigned R2 upload + webhook. */
app.post("/v1/process", async (c) => {
	if (!clientSecret()) return c.json({ error: "server_misconfigured" }, 503)
	if (!isAuthorized(c.req.header("authorization")))
		return c.json({ error: "unauthorized" }, 401)

	let raw: unknown
	try {
		raw = await c.req.json()
	} catch {
		return c.json({ error: "invalid_json" }, 400)
	}

	if (!isHandoffPayload(raw)) return c.json({ error: "invalid_body" }, 400)

	const whs = webhookSecret()
	if (!whs) return c.json({ error: "webhook_secret_not_configured" }, 503)

	if (isAssemblyJobKnown(raw.jobId)) {
		return c.json({ accepted: true as const, idempotent: true as const }, 202)
	}

	enqueueAssemblyJob(raw, whs)
	return c.json({ accepted: true as const }, 202)
})

/** Full content pipeline (content_pipeline_v1): script → TTS + images + sound → FFmpeg → R2 → callback. */
app.post("/v1/process-spec", async (c) => {
	if (!clientSecret()) return c.json({ error: "server_misconfigured" }, 503)
	if (!isAuthorized(c.req.header("authorization")))
		return c.json({ error: "unauthorized" }, 401)

	let raw: unknown
	try {
		raw = await c.req.json()
	} catch {
		return c.json({ error: "invalid_json" }, 400)
	}

	if (!isProcessorJobSpec(raw)) return c.json({ error: "invalid_body" }, 400)

	if (isSpecJobKnown(raw.jobId)) {
		return c.json({ accepted: true as const, idempotent: true as const }, 202)
	}

	enqueueSpecJob(raw)
	return c.json({ accepted: true as const }, 202)
})

const port = Number(process.env.PORT) || 8790
serve({ fetch: app.fetch, port }, (info) => {
	logger.info("processor_listening", { port: info.port })
})
