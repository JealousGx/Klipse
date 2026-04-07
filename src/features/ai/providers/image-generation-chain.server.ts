import "@tanstack/react-start/server-only";

import type { ChannelCreativeBrief } from "../prompts/creative-brief.types";
import { buildImageGenerationPrompt } from "../prompts/image-prompt.server";
import { fetchPollinationsImage } from "./pollinations-image.server";

export type ImageGenerationSource = "pollinations";

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
			width?: number;
			height?: number;
	  };

function resolveImagePrompt(input: GenerateImageInput): string {
	if (input.kind === "prompt") {
		return input.prompt;
	}
	return buildImageGenerationPrompt({ brief: input.brief, subject: input.subject });
}

/**
 * Image generation: Pollinations Flux (free, no key required).
 * Add a second provider here when/if a fallback is needed.
 */
export async function generateImageWithFallback(
	input: GenerateImageInput,
): Promise<{ source: ImageGenerationSource; buffer: ArrayBuffer }> {
	const prompt = resolveImagePrompt(input);
	const buffer = await fetchPollinationsImage({
		prompt,
		width: input.width,
		height: input.height,
	});
	return { source: "pollinations", buffer };
}
