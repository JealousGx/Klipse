import type { VideoJobListRow } from "@/features/video/video-job-list.types"

export const statusLabel: Record<VideoJobListRow["status"], string> = {
	queued: "Queued",
	dispatched: "Handoff",
	processing: "Processing",
	completed: "Done",
	failed: "Failed",
}

export function tagFromNiche(niche: string): string[] {
	const words = niche
		.split(/[\s,]+/)
		.map((w) => w.trim())
		.filter(Boolean)
		.slice(0, 4)
	return words.length ? words : ["destination"]
}
