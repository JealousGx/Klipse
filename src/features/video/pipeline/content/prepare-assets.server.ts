import "@tanstack/react-start/server-only";

import { getDb } from "@/db";
import { expiringAssets } from "@/db/schema/expiring-assets";
import type { VideoJobPrepareRefs } from "@/db/schema/video-jobs";
import { channelToCreativeBrief } from "@/features/ai/prompts/channel-brief.server";
import { buildVoiceoverTtsPayload } from "@/features/ai/prompts/voiceover-prompt.server";
import { synthesizeSpeechWithFallback } from "@/features/ai/providers/audio-generation-chain.server";
import { generateImageWithFallback } from "@/features/ai/providers/image-generation-chain.server";
import { generateSoundWithFallback } from "@/features/ai/providers/sound-generation-chain.server";
import type { ChannelRow } from "@/features/channels/channels.service.server";
import type { MeResponse } from "@/features/user/types/me";
import { expiringAssetRowId } from "@/lib/id";
import { uploadToR2 } from "@/lib/storage/r2.server";

const IMAGE_COUNT = 3;

/** 2 hours — generous window for any realistic assembly time. */
const ASSET_TTL_MS = 2 * 60 * 60 * 1000;

/**
 * Derives up to {@link IMAGE_COUNT} short visual prompts from the script (paragraphs / lines).
 */
export function visualPromptsFromScript(scriptMarkdown: string): string[] {
	const lines = scriptMarkdown
		.split(/\n+/)
		.map((s) => s.replace(/^#+\s*/, "").trim())
		.filter(Boolean);

	const out: string[] = [];
	for (const line of lines) {
		if (out.length >= IMAGE_COUNT) {
			break;
		}
		const chunk = line.slice(0, 400);
		if (chunk.length > 0) {
			out.push(chunk);
		}
	}
	while (out.length < IMAGE_COUNT) {
		out.push(out[0] ?? "cinematic imagery, soft lighting, high detail");
	}
	return out.slice(0, IMAGE_COUNT);
}

/**
 * Generates TTS audio, uploads to R2, registers a 2h TTL expiring_assets row,
 * and returns the public URL.
 */
async function prepareTtsAsset(input: {
	text: string;
	voice: string;
	userId: string;
	jobId: string;
}): Promise<string> {
	const { buffer } = await synthesizeSpeechWithFallback({
		kind: "raw",
		text: input.text,
		voice: input.voice,
	});

	const logicalKey = `u/${input.userId}/j/${input.jobId}/tts.mp3`;
	const publicUrl = await uploadToR2(
		logicalKey,
		Buffer.from(buffer),
		"audio/mpeg",
	);

	await getDb().insert(expiringAssets).values({
		id: expiringAssetRowId(),
		userId: input.userId,
		logicalKey,
		videoJobId: input.jobId,
		kind: "tts_intermediate",
		expiresAt: new Date(Date.now() + ASSET_TTL_MS),
	});

	return publicUrl;
}

/**
 * Generates an image via OpenRouter FLUX.2 → Replicate FLUX Schnell chain,
 * uploads to R2, registers a 2h TTL expiring_assets row, and returns the public URL.
 */
async function prepareImageAsset(input: {
	prompt: string;
	aspectRatio: "16:9" | "9:16" | "1:1";
	userId: string;
	jobId: string;
	index: number;
}): Promise<string> {
	const { source, buffer } = await generateImageWithFallback({
		kind: "prompt",
		prompt: input.prompt,
		aspectRatio: input.aspectRatio,
	});

	const ext = source === "replicate" ? "webp" : "png";
	const contentType = source === "replicate" ? "image/webp" : "image/png";
	const logicalKey = `u/${input.userId}/j/${input.jobId}/img-${input.index}.${ext}`;

	const publicUrl = await uploadToR2(
		logicalKey,
		Buffer.from(buffer),
		contentType,
	);

	await getDb().insert(expiringAssets).values({
		id: expiringAssetRowId(),
		userId: input.userId,
		logicalKey,
		videoJobId: input.jobId,
		kind: "image_intermediate",
		expiresAt: new Date(Date.now() + ASSET_TTL_MS),
	});

	return publicUrl;
}

/**
 * Generates background sound via ElevenLabs (Creator+ only), uploads to R2,
 * registers a 2h TTL expiring_assets row, and returns the public URL.
 * Returns null when gated out (plan, toggle, no keys) — video continues without sound.
 */
async function prepareSoundAsset(input: {
	channel: ChannelRow;
	targetSeconds: number;
	userPlan: MeResponse["plan"];
	userId: string;
	jobId: string;
	brief: ReturnType<typeof channelToCreativeBrief>;
}): Promise<string | null> {
	const result = await generateSoundWithFallback({
		brief: input.brief,
		targetSeconds: input.targetSeconds,
		soundPromptHint: input.channel.soundPromptHint,
		plan: input.userPlan,
		soundEnabled: input.channel.soundEnabled,
	});

	if (!result) return null;

	const logicalKey = `u/${input.userId}/j/${input.jobId}/sound.mp3`;
	const publicUrl = await uploadToR2(
		logicalKey,
		Buffer.from(result.buffer),
		"audio/mpeg",
	);

	await getDb().insert(expiringAssets).values({
		id: expiringAssetRowId(),
		userId: input.userId,
		logicalKey,
		videoJobId: input.jobId,
		kind: "sound_intermediate",
		expiresAt: new Date(Date.now() + ASSET_TTL_MS),
	});

	return publicUrl;
}

/**
 * Resolves all prepare-stage assets:
 * - TTS audio + images: generated in parallel → uploaded to R2 (2h TTL)
 * - Background sound: generated after TTS (needs targetSeconds), non-blocking
 *   (Creator+ only; returns null when gated — video continues without sound)
 *
 * Aspect ratio is taken directly from channel config; no dimension conversion needed.
 */
export async function resolvePrepareRefs(input: {
	scriptMarkdown: string;
	channel: ChannelRow;
	userId: string;
	jobId: string;
	userPlan: MeResponse["plan"];
}): Promise<VideoJobPrepareRefs> {
	const brief = channelToCreativeBrief(input.channel);
	const { plainText, voice, targetSeconds } = buildVoiceoverTtsPayload(
		brief,
		input.scriptMarkdown,
	);
	const prompts = visualPromptsFromScript(input.scriptMarkdown);
	const aspectRatio = input.channel.config.aspect_ratio ?? "16:9";

	// TTS + images in parallel.
	const [ttsAudioUrl, ...imageUrls] = await Promise.all([
		prepareTtsAsset({
			text: plainText,
			voice,
			userId: input.userId,
			jobId: input.jobId,
		}),
		...prompts.map((prompt, i) =>
			prepareImageAsset({
				prompt,
				aspectRatio,
				userId: input.userId,
				jobId: input.jobId,
				index: i,
			}),
		),
	]);

	// Sound: runs after TTS (needs targetSeconds); extends the prepare stage when enabled.
	const soundAudioUrl =
		(await prepareSoundAsset({
			channel: input.channel,
			targetSeconds,
			userPlan: input.userPlan,
			userId: input.userId,
			jobId: input.jobId,
			brief,
		})) ?? undefined;

	return {
		imageUrls,
		ttsAudioUrl,
		...(soundAudioUrl ? { soundAudioUrl } : {}),
	};
}
