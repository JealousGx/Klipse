import "@tanstack/react-start/server-only"

import { siteConfig } from "@/config/site"
import type {
	VideoJobArtifacts,
	VideoJobInputPayload,
} from "@/db/schema/video-jobs"

import type { YoutubeVideoMetadataInput } from "./youtube-upload-api.server"

function firstLineFromScript(script: string | undefined): string | null {
	if (!script?.trim()) return null
	const line = script.split(/\r?\n/).find((l) => l.trim().length > 0)
	const t = line?.replace(/^#+\s*/, "").trim()
	return t ? t.slice(0, 80) : null
}

function buildHashtags(tags: string[]): string {
	return tags.map((t) => `#${t.replace(/\s+/g, "")}`).join(" ")
}

/**
 * Builds YouTube video metadata from AI-generated artifacts.
 *
 * Title: AI title → first script line → idea string → channel fallback.
 * Description: AI caption + hashtags + app footer.
 * Tags: AI tags array.
 * Privacy: always "public".
 */
export function buildYoutubeVideoMetadata(input: {
	channelName: string
	artifacts: VideoJobArtifacts | null
	inputPayload: VideoJobInputPayload | null
	aiDisclosure: boolean
}): YoutubeVideoMetadataInput {
	const art = input.artifacts
	const idea = input.inputPayload?.idea?.trim() ?? ""

	// Title — AI first, then fallbacks.
	const titleRaw =
		art?.title?.trim() ||
		firstLineFromScript(art?.scriptText) ||
		(idea ? idea.slice(0, 72) : null) ||
		`${input.channelName.trim()} — video`
	const title =
		titleRaw.trim().slice(0, 100) || `${input.channelName.trim()} — Klipse`

	// Tags — AI array, always append "klipse" brand tag at publish time.
	const baseTags: string[] = art?.tags && art.tags.length > 0 ? art.tags : []
	const tags: string[] = baseTags.includes("klipse")
		? baseTags
		: [...baseTags, "klipse"]

	// Description — AI caption + hashtags + app footer.
	const hashtagLine = buildHashtags(tags)
	const appName = siteConfig.name || "Klipse"
	const appUrl = siteConfig.origin || "https://klipse.app"

	const parts: string[] = []

	if (art?.description?.trim()) {
		parts.push(art.description.trim())
	} else if (idea) {
		parts.push(idea)
	}

	if (hashtagLine) parts.push(hashtagLine)

	if (input.aiDisclosure) {
		parts.push("Includes AI-generated or assisted content.")
	}

	parts.push(`Made with ${appName} AI · ${appUrl}`)

	const description = parts.join("\n\n").slice(0, 5000)

	return {
		title,
		description,
		tags,
		privacyStatus: "public",
		selfDeclaredMadeForKids: false,
	}
}
