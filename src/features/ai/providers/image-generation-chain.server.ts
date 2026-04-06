import "@tanstack/react-start/server-only";

import type { ChannelCreativeBrief } from "../prompts/creative-brief.types";
import { buildImageGenerationPrompt } from "../prompts/image-prompt.server";
import { generateImageOpenAiDalle3 } from "./openai-image.server";
import { fetchPollinationsImage } from "./pollinations-image.server";

export type ImageGenerationSource = "pollinations" | "openai";

export type GenerateImageInput =
	| {
			kind: "prompt";
			prompt: string;
			width?: number;
			height?: number;
	  }
	| {
			kind: "brief";
			brief: ChannelCreativeBrief;
			subject: string;
			aspectIntent?: "9:16_vertical" | "1:1" | "16:9";
			width?: number;
			height?: number;
	  };

function resolveImagePrompt(input: GenerateImageInput): string {
	if (input.kind === "prompt") {
		return input.prompt;
	}
	return buildImageGenerationPrompt({
		brief: input.brief,
		subject: input.subject,
		aspectIntent: input.aspectIntent,
	});
}

/**
 * Image: Pollinations (Flux/SDXL-class) → OpenAI DALL·E 3.
 * Use `kind: "brief"` to apply niche + destination + tone-aware image prompts.
 */
export async function generateImageWithFallback(
	input: GenerateImageInput,
): Promise<{ source: ImageGenerationSource; buffer: ArrayBuffer }> {
	const prompt = resolveImagePrompt(input);
	const width = input.width;
	const height = input.height;
	try {
		const buffer = await fetchPollinationsImage({ prompt, width, height });
		return { source: "pollinations", buffer };
	} catch {
		const { url } = await generateImageOpenAiDalle3({ prompt });
		const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
		if (!res.ok) {
			throw new Error(`openai_image_fetch_${res.status}`);
		}
		return { source: "openai", buffer: await res.arrayBuffer() };
	}
}
