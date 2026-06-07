import "@tanstack/react-start/server-only"

import type { ProcessorJobSpec } from "@klipse/video-assembly-shared"
import { eq } from "drizzle-orm"

import { siteConfig } from "@/config/site"
import { getDb } from "@/db"
import { channels } from "@/db/schema/channels"
import { users } from "@/db/schema/users"
import { videoJobs } from "@/db/schema/video-jobs"
import { buildOpenRouterModelChain } from "@/features/ai/config/model-routing"
import { bundleProviderKeysForProcessor } from "@/features/ai/lib/provider-key-bundle.server"
import { channelToCreativeBrief } from "@/features/ai/prompts/channel-brief.server"
import { selectVoiceForChannelTone } from "@/features/ai/prompts/voiceover-prompt.server"
import { buildScriptPrompts } from "@/features/ai/script-generation.server"
import { parseChannelConfig } from "@/features/channels/channel-config.schema"
import { clampTargetDuration } from "@/features/entitlements"
import type { MeResponse } from "@/features/user/types/me"
import { logger } from "@/lib/logger"
import { withPerfTiming } from "@/lib/perf-timing"
import { generateJobPresignedUrls } from "@/lib/storage/r2-presigned.server"
import { getAppPublicBaseUrl } from "@/lib/video-processor/app-base-url.server"

const SOUND_ALLOWED_PLANS: MeResponse["plan"][] = ["creator", "empire"]

function buildSoundPrompt(
	niche: string,
	tone: string,
	hint: string | null,
): string {
	if (hint?.trim()) return hint.trim()
	const t = tone.toLowerCase()
	if (t === "dark")
		return `dark atmospheric ambient sound for ${niche} video background`
	if (t === "fun")
		return `upbeat energetic background sound effect for ${niche} video`
	return `calm focused ambient music for ${niche} educational video`
}

/** Fetches all job/channel/user data from DB and builds a complete ProcessorJobSpec. */
export async function buildProcessorJobSpec(
	jobId: string,
): Promise<ProcessorJobSpec> {
	const db = getDb()
	const id = jobId.trim()

	const [job] = await db
		.select({
			id: videoJobs.id,
			userId: videoJobs.userId,
			channelId: videoJobs.channelId,
			inputPayload: videoJobs.inputPayload,
			userPlan: users.plan,
			channelName: channels.name,
			channelNiche: channels.niche,
			channelConfig: channels.config,
			channelSoundEnabled: channels.soundEnabled,
			channelSoundPromptHint: channels.soundPromptHint,
		})
		.from(videoJobs)
		.innerJoin(users, eq(videoJobs.userId, users.id))
		.innerJoin(channels, eq(videoJobs.channelId, channels.id))
		.where(eq(videoJobs.id, id))
		.limit(1)

	if (!job) throw new Error("video_job_not_found")

	const idea = job.inputPayload?.idea?.trim()
	if (!idea) throw new Error("video_job_missing_idea")

	logger.info("spec_build_start", { jobId: id, userId: job.userId })

	const config = parseChannelConfig(job.channelConfig)
	const plan = job.userPlan as MeResponse["plan"]
	const brief = channelToCreativeBrief({
		id: job.channelId,
		userId: job.userId,
		name: job.channelName,
		niche: job.channelNiche,
		config,
		platform: "unlinked",
		externalChannelId: null,
		externalChannelTitle: null,
		externalChannelHandle: null,
		externalChannelThumbnailUrl: null,
		oauthConnected: false,
		boundExternalAccountId: null,
		soundEnabled: job.channelSoundEnabled,
		soundPromptHint: job.channelSoundPromptHint,
		createdAt: new Date(),
		updatedAt: new Date(),
	})

	const { system: scriptSystemPrompt, user: scriptUserPrompt } =
		buildScriptPrompts({
			...brief,
			idea,
		})

	const targetDuration = clampTargetDuration(config.target_duration, plan)
	const isSoundEligible =
		job.channelSoundEnabled && SOUND_ALLOWED_PLANS.includes(plan)
	const soundPrompt = isSoundEligible
		? buildSoundPrompt(
				job.channelNiche,
				config.tone,
				job.channelSoundPromptHint,
			)
		: null

	const [providerKeys, presignedUrls] = await withPerfTiming(
		"spec_build.io",
		{ jobId: id, userId: job.userId },
		() =>
			Promise.all([
				bundleProviderKeysForProcessor(),
				generateJobPresignedUrls({
					userId: job.userId,
					jobId: id,
				}),
			]),
	)

	const spec = {
		jobId: id,
		userId: job.userId,
		channelId: job.channelId,
		scriptSystemPrompt,
		scriptUserPrompt,
		openrouterScriptModels: buildOpenRouterModelChain(),
		ttsVoice: selectVoiceForChannelTone(config.tone),
		targetDuration,
		aspectRatio: config.aspect_ratio ?? "9:16",
		soundPrompt,
		soundDurationSeconds: Math.min(targetDuration, 22),
		freeTierWatermark: plan === "free",
		watermarkLabel: siteConfig.name.trim().slice(0, 128) || "Klipse",
		providerKeys,
		presignedUrls,
		callbackBaseUrl: getAppPublicBaseUrl(),
		callbackSecret: process.env.VIDEO_PROCESSOR_WEBHOOK_SECRET?.trim() ?? "",
	}

	logger.info("spec_build_complete", {
		jobId: id,
		userId: job.userId,
		targetDuration,
		plan,
		isSoundEligible,
		modelChain: spec.openrouterScriptModels,
		ttsVoice: spec.ttsVoice,
	})

	return spec
}
