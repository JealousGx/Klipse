import "@tanstack/react-start/server-only";

import type { ChannelCreativeBrief } from "../prompts/creative-brief.types";
import { buildImageGenerationPrompt } from "../prompts/image-prompt.server";
import {
	generateImageOpenRouter,
	isOpenRouterImageConfigured,
} from "./openrouter-image.server";
import {
	generateImageReplicate,
	isReplicateConfigured,
} from "./replicate-image.server";

export type ImageGenerationSource = "openrouter" | "replicate";

export type GenerateImageInput =
	| {
			kind: "prompt";
			prompt: string;
			aspectRatio?: "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
	  }
	| {
			kind: "brief";
			brief: ChannelCreativeBrief;
			subject: string;
			aspectRatio?: "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
	  };

function resolveImagePrompt(input: GenerateImageInput): string {
	if (input.kind === "prompt") return input.prompt;
	return buildImageGenerationPrompt({
		brief: input.brief,
		subject: input.subject,
	});
}

function resolveAspectRatio(
	input: GenerateImageInput,
): "1:1" | "16:9" | "9:16" | "4:3" | "3:4" {
	return input.aspectRatio ?? "9:16";
}

/**
 * Image generation chain:
 *   1. OpenRouter FLUX.2 (free) — primary
 *   2. Replicate FLUX Schnell (~$0.003/img) — fallback
 *
 * Throws only when all providers fail.
 */
export async function generateImageWithFallback(
	input: GenerateImageInput,
): Promise<{ source: ImageGenerationSource; buffer: ArrayBuffer }> {
	const prompt = resolveImagePrompt(input);
	const aspectRatio = resolveAspectRatio(input);
	const errors: string[] = [];

	// 1. OpenRouter FLUX.2 (free)
	if (await isOpenRouterImageConfigured()) {
		try {
			const buffer = await generateImageOpenRouter({ prompt, aspectRatio });
			return { source: "openrouter", buffer };
		} catch (e) {
			errors.push(`openrouter: ${e instanceof Error ? e.message : String(e)}`);
		}
	}

	// 2. Replicate FLUX Schnell (paid fallback)
	if (await isReplicateConfigured()) {
		try {
			const buffer = await generateImageReplicate({ prompt, aspectRatio });
			return { source: "replicate", buffer };
		} catch (e) {
			errors.push(`replicate: ${e instanceof Error ? e.message : String(e)}`);
		}
	}

	throw new Error(
		`image_generation_all_failed: ${errors.join(" | ") || "no providers configured"}`,
	);
}
