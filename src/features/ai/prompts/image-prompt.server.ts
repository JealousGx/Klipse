import "@tanstack/react-start/server-only";

import type { ChannelCreativeBrief } from "./creative-brief.types";

export type ImagePromptIntent = {
	brief: ChannelCreativeBrief;
	/** What the frame should depict (subject, action, setting). */
	subject: string;
};

const NEUTRAL_SURFACE_FALLBACK = "video for your audience";

/**
 * Single prompt string for Pollinations Flux / SDXL-class image generation.
 * Aspect ratio is driven by `brief.aspectRatio` (explicit channel config field),
 * not inferred from video duration or publishing platform.
 */
export function buildImageGenerationPrompt(input: ImagePromptIntent): string {
	const { brief, subject } = input;

	const aspectRatio = brief.aspectRatio ?? "9:16";

	const aspectCopy =
		aspectRatio === "9:16"
			? "vertical 9:16 composition, mobile-first, subject in safe zones for on-screen title and caption overlays"
			: aspectRatio === "1:1"
				? "square 1:1 composition, centered focal subject"
				: "wide 16:9 cinematic composition";

	const toneVisual =
		brief.tone === "dark"
			? "moody lighting, high contrast, dramatic shadows, cohesive but not horror unless niche demands"
			: brief.tone === "fun"
				? "vibrant color, energetic staging, playful but professional"
				: "clean, readable, trustworthy, educational clarity";

	const brand =
		brief.primaryColorHex?.trim() &&
		/^#[0-9A-Fa-f]{6}$/.test(brief.primaryColorHex.trim())
			? `Accent palette may subtly echo brand color ${brief.primaryColorHex.trim()} (do not plaster logos or text).`
			: "Cohesive color grade suitable for the niche.";

	const dest = brief.destinationDisplayName?.trim()
		? `Feels native to a channel about "${brief.niche}" aimed at viewers watching ${brief.publishingSurfaceLabel ?? NEUTRAL_SURFACE_FALLBACK} (${brief.destinationDisplayName.trim()}).`
		: `Feels native to a channel about "${brief.niche}" for ${brief.publishingSurfaceLabel ?? NEUTRAL_SURFACE_FALLBACK}.`;

	const lines = [
		"Professional high-quality digital still, no watermark, no UI mockups, no fake app screenshots unless the brief explicitly asks.",
		"Designed to stop the scroll: clear focal subject, strong focal point, readable at small sizes.",
		aspectCopy,
		toneVisual,
		brand,
		dest,
		`Niche: ${brief.niche}. Channel: ${brief.channelName}.`,
		`Subject and scene: ${subject.trim()}`,
		"No cluttered text in the image; if text appears, it must be minimal, legible, and intentional.",
		"Photorealistic or high-end stylized 3D render consistent with the niche — avoid generic stock-photo clichés.",
	];

	return lines.join(" ");
}
