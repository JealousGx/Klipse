import "@tanstack/react-start/server-only";

import { logger } from "@/lib/logger";

/**
 * YouTube Data API v3 resumable upload (§2.12: upload + metadata).
 * @see https://developers.google.com/youtube/v3/guides/uploading_a_video
 */
export type YoutubeVideoMetadataInput = {
	title: string;
	description: string;
	tags: string[];
	/** Maps to `status.privacyStatus`. */
	privacyStatus: "public" | "unlisted" | "private";
	selfDeclaredMadeForKids: boolean;
};

export type YoutubeResumableUploadResult = {
	videoId: string;
};

const INIT_URL =
	"https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status";

const MAX_UPLOAD_BYTES = 512 * 1024 * 1024;

/**
 * Two-step resumable upload: initialize session, then PUT video bytes to the returned Location.
 */
export async function uploadMp4ToYoutube(input: {
	accessToken: string;
	metadata: YoutubeVideoMetadataInput;
	videoBytes: Buffer;
	/** Defaults to `video/mp4`. */
	contentType?: string;
}): Promise<YoutubeResumableUploadResult> {
	if (input.videoBytes.byteLength > MAX_UPLOAD_BYTES) {
		throw new Error("youtube_upload_too_large");
	}

	const contentType = input.contentType ?? "video/mp4";
	const uploadStart = Date.now();

	const body = {
		snippet: {
			title: input.metadata.title.slice(0, 100),
			description: `${input.metadata.description.slice(0, 4997)}...`,
			// tags: fitTagsToYoutubeBudget(input.metadata.tags),
			tags: input.metadata.tags.slice(0, 10), // fitTagsToYoutubeBudget is not working. So, slicing to just 10 tags for now.
			categoryId: "22",
		},
		status: {
			privacyStatus: input.metadata.privacyStatus,
			selfDeclaredMadeForKids: input.metadata.selfDeclaredMadeForKids,
		},
	};

	const init = await fetch(INIT_URL, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${input.accessToken}`,
			"Content-Type": "application/json; charset=UTF-8",
			"X-Upload-Content-Length": String(input.videoBytes.byteLength),
			"X-Upload-Content-Type": contentType,
		},
		body: JSON.stringify(body),
	});

	if (!init.ok) {
		const t = await init.text();
		logger.error("youtube_upload_init_failed", {
			status: init.status,
			body: t.slice(0, 200),
		});
		throw new Error(`youtube_upload_init_failed:${init.status}:${t}`);
	}

	const location = init.headers.get("Location");
	if (!location?.trim()) {
		throw new Error("youtube_upload_missing_location");
	}

	logger.info("youtube_upload_session_created", {
		sizeBytes: input.videoBytes.byteLength,
	});

	const put = await fetch(location, {
		method: "PUT",
		headers: {
			Authorization: `Bearer ${input.accessToken}`,
			"Content-Type": contentType,
			"Content-Length": String(input.videoBytes.byteLength),
		},
		body: new Uint8Array(input.videoBytes),
	});

	if (!put.ok) {
		const t = await put.text();
		logger.error("youtube_upload_put_failed", {
			status: put.status,
			body: t.slice(0, 200),
		});
		throw new Error(`youtube_upload_put_failed:${put.status}:${t}`);
	}

	const json = (await put.json()) as { id?: string };
	const videoId = json.id?.trim();
	if (!videoId) {
		throw new Error("youtube_upload_missing_video_id");
	}

	logger.info("youtube_upload_complete", {
		videoId,
		sizeBytes: input.videoBytes.byteLength,
		durationMs: Date.now() - uploadStart,
		title: input.metadata.title,
		privacyStatus: input.metadata.privacyStatus,
	});

	return { videoId };
}

// YouTube counts tags as "tag1, tag2, tag3" (comma+space separated) with a 500-char total budget.
// Separator cost = 2 chars (", "), not 1. This helper fits as many tags as possible within that budget.
function fitTagsToYoutubeBudget(tags: string[], budget = 500): string[] {
	// Pre-process: split on commas (LLMs often emit "foo, bar" as one tag), trim, deduplicate.
	const seen = new Set<string>();
	const flat: string[] = [];
	for (const raw of tags) {
		for (const piece of raw.split(",")) {
			const t = piece.trim().slice(0, 30);
			if (t.length >= 2 && !seen.has(t)) {
				seen.add(t);
				flat.push(t);
			}
		}
	}

	const result: string[] = [];
	let used = 0;

	for (const t of flat) {
		const cost = result.length === 0 ? t.length : t.length + 2; // +2 for ", " separator (YouTube counts comma+space)
		if (used + cost > budget) break;
		result.push(t);
		used += cost;
	}

	// Final guard: ensure the joined string is actually within budget.
	while (result.length > 0 && result.join(", ").length > budget) {
		result.pop();
	}

	return result;
}
