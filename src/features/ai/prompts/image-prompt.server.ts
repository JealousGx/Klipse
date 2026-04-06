import "@tanstack/react-start/server-only";

import type { ChannelCreativeBrief } from "./creative-brief.types";

export type ImagePromptIntent = {
	brief: ChannelCreativeBrief;
	/** What the frame should depict (subject, action, setting). */
	subject: string;
	/** Default: portrait vertical feed; optional square or landscape. */
	aspectIntent?: "9:16_vertical" | "1:1" | "16:9";
};

/**
 * Single prompt string for Pollinations Flux / SDXL-class and DALL·E 3.
 * Optimized for **thumbnail / hero frames**: niche-native visuals, scroll-stopping clarity,
 * and suitability for the connected publishing destination (not stock-generic).
 */
export function buildImageGenerationPrompt(input: ImagePromptIntent): string {
	const { brief, subject, aspectIntent = "9:16_vertical" } = input;

	const aspect =
		aspectIntent === "9:16_vertical"
			? "vertical 9:16 composition, mobile-first, subject in safe zones for on-screen title and caption overlays"
			: aspectIntent === "1:1"
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
		? `Feels native to a channel about "${brief.niche}" aimed at viewers on ${brief.publishingSurfaceLabel ?? "short-form video"} (${brief.destinationDisplayName.trim()}).`
		: `Feels native to a channel about "${brief.niche}" on ${brief.publishingSurfaceLabel ?? "short-form video"}.`;

	const lines = [
		"Professional high-quality digital still, no watermark, no UI mockups, no fake app screenshots unless the brief explicitly asks.",
		"Designed to stop the scroll: clear focal subject, strong focal point, readable at small sizes.",
		aspect,
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
