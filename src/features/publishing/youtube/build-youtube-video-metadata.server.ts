import "@tanstack/react-start/server-only";

import type {
	VideoJobArtifacts,
	VideoJobInputPayload,
} from "@/db/schema/video-jobs";

import type { YoutubeVideoMetadataInput } from "./youtube-upload-api.server";

/** Default visibility for automated uploads (FEATURE_DOC §2.12 metadata.visibility). */
export const YOUTUBE_DEFAULT_PRIVACY_STATUS: YoutubeVideoMetadataInput["privacyStatus"] =
	"unlisted";

function firstLineFromScript(script: string | undefined): string | null {
	if (!script?.trim()) {
		return null;
	}
	const line = script.split(/\r?\n/).find((l) => l.trim().length > 0);
	const t = line?.replace(/^#+\s*/, "").trim();
	return t ? t.slice(0, 80) : null;
}

function tagsFromNiche(niche: string): string[] {
	const words = niche
		.split(/[\s,]+/)
		.map((w) => w.trim().toLowerCase())
		.filter(Boolean)
		.slice(0, 8);
	return words.length ? words : ["klipse"];
}

/**
 * Builds title / description / tags per FEATURE_DOC §2.12 (metadata block).
 */
export function buildYoutubeVideoMetadata(input: {
	channelName: string;
	niche: string;
	artifacts: VideoJobArtifacts | null;
	inputPayload: VideoJobInputPayload | null;
	aiDisclosure: boolean;
}): YoutubeVideoMetadataInput {
	const idea = input.inputPayload?.idea?.trim() ?? "";
	const scriptLine = firstLineFromScript(input.artifacts?.scriptText);
	const titleBase =
		scriptLine ??
		(idea ? idea.slice(0, 72) : `${input.channelName.trim()} — video`);
	const title =
		titleBase.trim().slice(0, 100) || `${input.channelName.trim()} — Klipse`;

	const tags = tagsFromNiche(input.niche);

	let description = [
		`Created with Klipse for “${input.channelName.trim()}”.`,
		`Niche: ${input.niche.trim()}`,
		"",
		idea ? `Idea: ${idea}` : "",
	]
		.filter(Boolean)
		.join("\n");

	if (input.aiDisclosure) {
		description += "\n\nIncludes AI-generated or assisted content.";
	}

	return {
		title,
		description: description.slice(0, 5000),
		tags,
		privacyStatus: YOUTUBE_DEFAULT_PRIVACY_STATUS,
		selfDeclaredMadeForKids: false,
	};
}
