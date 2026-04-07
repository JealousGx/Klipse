import "@tanstack/react-start/server-only";

import type { VideoJobPrepareRefs } from "@/db/schema/video-jobs";
import { channelToCreativeBrief } from "@/features/ai/prompts/channel-brief.server";
import { buildVoiceoverTtsPayload } from "@/features/ai/prompts/voiceover-prompt.server";
import { pollinationsImageUrl } from "@/features/ai/providers/pollinations-image.server";
import { pollinationsAudioUrl } from "@/features/ai/providers/pollinations-tts.server";
import type { ChannelRow } from "@/features/channels/channels.service.server";

const IMAGE_COUNT = 3;

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
			out[0] ??
				"cinematic vertical short-form imagery, soft lighting, high detail",
		);
	}
	return out.slice(0, IMAGE_COUNT);
}

/**
 * Parallel Pollinations URL resolution — **URLs only** (processor fetches bytes).
 */
export async function resolvePrepareRefs(input: {
	scriptMarkdown: string;
	channel: ChannelRow;
}): Promise<VideoJobPrepareRefs> {
	const brief = channelToCreativeBrief(input.channel);
	const { plainText, pollinationsVoice } = buildVoiceoverTtsPayload(
		brief,
		input.scriptMarkdown,
	);
	const prompts = visualPromptsFromScript(input.scriptMarkdown);

	const ttsPromise = pollinationsAudioUrl({
		text: plainText,
		voice: pollinationsVoice,
	});
	const imagePromises = prompts.map((prompt) =>
		pollinationsImageUrl({
			prompt,
			width: 1280,
			height: 720,
		}),
	);

	const settled = await Promise.all([ttsPromise, ...imagePromises]);
	const ttsAudioUrl = settled[0];
	const imageUrls = settled.slice(1);

	return { imageUrls, ttsAudioUrl };
}
