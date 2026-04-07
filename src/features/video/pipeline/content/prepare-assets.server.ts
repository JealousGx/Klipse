import "@tanstack/react-start/server-only";

import { getDb } from "@/db";
import { expiringAssets } from "@/db/schema/expiring-assets";
import type { VideoJobPrepareRefs } from "@/db/schema/video-jobs";
import { channelToCreativeBrief } from "@/features/ai/prompts/channel-brief.server";
import { buildVoiceoverTtsPayload } from "@/features/ai/prompts/voiceover-prompt.server";
import { synthesizeSpeechWithFallback } from "@/features/ai/providers/audio-generation-chain.server";
import { pollinationsImageUrl } from "@/features/ai/providers/pollinations-image.server";
import type { ChannelRow } from "@/features/channels/channels.service.server";
import { expiringAssetRowId } from "@/lib/id";
import { uploadToR2 } from "@/lib/storage/r2.server";

const IMAGE_COUNT = 3;

/** 2 hours — generous window for any realistic assembly time. */
const TTS_ASSET_TTL_MS = 2 * 60 * 60 * 1000;

/** Maps channel aspect_ratio config to pixel dimensions for image generation. */
const ASPECT_DIMENSIONS: Record<"16:9" | "9:16" | "1:1", { width: number; height: number }> = {
	"16:9": { width: 1280, height: 720 },
	"9:16": { width: 720, height: 1280 },
	"1:1": { width: 1080, height: 1080 },
};

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
		out.push(
			out[0] ?? "cinematic imagery, soft lighting, high detail",
		);
	}
	return out.slice(0, IMAGE_COUNT);
}

/**
 * Generates TTS audio, uploads to R2 (env-prefixed), registers a short-TTL
 * `expiring_assets` row, and returns the public URL.
 *
 * The processor fetches this stable R2 URL — no dependency on third-party URLs.
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
		expiresAt: new Date(Date.now() + TTS_ASSET_TTL_MS),
	});

	return publicUrl;
}

/**
 * Resolves all prepare-stage assets in parallel:
 * - TTS audio: generated → uploaded to R2 → stable URL registered in expiring_assets (2h TTL)
 * - Images: Pollinations Flux URLs (processor fetches directly)
 *
 * Dimensions are derived from the channel's explicit `aspect_ratio` config field,
 * not inferred from video duration or publishing platform.
 */
export async function resolvePrepareRefs(input: {
	scriptMarkdown: string;
	channel: ChannelRow;
	userId: string;
	jobId: string;
}): Promise<VideoJobPrepareRefs> {
	const brief = channelToCreativeBrief(input.channel);
	const { plainText, voice } = buildVoiceoverTtsPayload(brief, input.scriptMarkdown);
	const prompts = visualPromptsFromScript(input.scriptMarkdown);

	const aspectRatio = input.channel.config.aspect_ratio ?? "16:9";
	const { width, height } = ASPECT_DIMENSIONS[aspectRatio];

	const [ttsAudioUrl, ...imageUrls] = await Promise.all([
		prepareTtsAsset({
			text: plainText,
			voice,
			userId: input.userId,
			jobId: input.jobId,
		}),
		...prompts.map((prompt) =>
			pollinationsImageUrl({ prompt, width, height }),
		),
	]);

	return { imageUrls, ttsAudioUrl };
}
