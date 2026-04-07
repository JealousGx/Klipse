import "@tanstack/react-start/server-only";

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

	const body = {
		snippet: {
			title: input.metadata.title.slice(0, 100),
			description: input.metadata.description.slice(0, 5000),
			tags: input.metadata.tags.slice(0, 30).map((t) => t.slice(0, 30)),
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
		throw new Error(`youtube_upload_init_failed:${init.status}:${t}`);
	}

	const location = init.headers.get("Location");
	if (!location?.trim()) {
		throw new Error("youtube_upload_missing_location");
	}

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
		throw new Error(`youtube_upload_put_failed:${put.status}:${t}`);
	}

	const json = (await put.json()) as { id?: string };
	const videoId = json.id?.trim();
	if (!videoId) {
		throw new Error("youtube_upload_missing_video_id");
	}

	return { videoId };
}
