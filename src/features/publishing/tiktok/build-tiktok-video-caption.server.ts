import "@tanstack/react-start/server-only";

import { siteConfig } from "@/config/site";
import type {
	VideoJobArtifacts,
	VideoJobInputPayload,
} from "@/db/schema/video-jobs";

const TIKTOK_CAPTION_MAX = 2200;
const FOOTER = `\n\nMade with ${siteConfig.name} AI`;

/**
 * Builds a TikTok caption (the `title` field in the Content Posting API).
 *
 * TikTok has a single caption field (max 2200 UTF-16 chars) that combines
 * description and hashtags — there is no separate tags array.
 *
 * Format: <description>\n\n#tag1 #tag2 ...\n\nMade with Klipse AI
 */
export function buildTiktokVideoCaption(input: {
	artifacts: VideoJobArtifacts | null;
	inputPayload: VideoJobInputPayload | null;
}): string {
	const art = input.artifacts;
	const idea = input.inputPayload?.idea?.trim() ?? "";

	// Base text: AI description, else fall back to idea.
	const base = art?.description?.trim() || (idea ? idea : "");

	// Budget: total - footer - room for hashtags separator (\n\n = 2 chars).
	const footerLen = FOOTER.length;
	const maxBase = TIKTOK_CAPTION_MAX - footerLen - 50; // 50-char buffer for hashtags line
	const truncatedBase = base.slice(0, maxBase);

	// Build hashtags from AI tags + brand tag: "horror stories" → "#horrorstories"
	const rawTags = Array.isArray(art?.tags) ? (art.tags as string[]) : [];
	const tags = rawTags.includes("klipse") ? rawTags : [...rawTags, "klipse"];
	const hashtagParts: string[] = [];
	let hashtagLen = 0;
	for (const tag of tags) {
		const ht = `#${tag.replace(/\s+/g, "").replace(/[^a-zA-Z0-9_]/g, "")}`;
		if (ht.length <= 1) continue; // "#" alone is useless
		// +1 for space separator
		const cost = hashtagLen === 0 ? ht.length : ht.length + 1;
		const totalLen = truncatedBase.length + 2 + hashtagLen + cost + footerLen;
		if (totalLen > TIKTOK_CAPTION_MAX) break;
		hashtagParts.push(ht);
		hashtagLen += cost;
	}

	const parts: string[] = [];
	if (truncatedBase) parts.push(truncatedBase);
	if (hashtagParts.length > 0) parts.push(hashtagParts.join(" "));
	parts.push(FOOTER.trim());

	return parts.join("\n\n").slice(0, TIKTOK_CAPTION_MAX);
}
