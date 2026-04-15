import type {
	ProcessorJobSpec,
	ProcessorProviderKey,
} from "@klipse/video-assembly-shared";

import { reportKeyFailure } from "../utils/callbacks";
import { withTiming } from "../utils/logger";

const GOOGLE_TTS_BASE =
	"https://texttospeech.googleapis.com/v1/text:synthesize";
const UNREAL_SPEECH_BASE = "https://api.v8.unrealspeech.com";
const STREAM_CHAR_LIMIT = 950;
const DEFAULT_GOOGLE_VOICE =
	process.env.GOOGLE_TTS_VOICE_NAME?.trim() || "en-US-Wavenet-G";

function makeHttpErr(
	status: number,
	body: string,
	retryAfter: string | null,
): Error {
	const err = new Error(`http_${status}:${body.slice(0, 200)}`) as Error & {
		httpStatus: number;
		bodySnippet: string;
		retryAfterHeader: string | null;
	};
	err.httpStatus = status;
	err.bodySnippet = body.slice(0, 800);
	err.retryAfterHeader = retryAfter;
	return err;
}

function isHttpErr(e: unknown): e is Error & {
	httpStatus: number;
	bodySnippet: string;
	retryAfterHeader: string | null;
} {
	return e instanceof Error && "httpStatus" in e;
}

async function googleTts(
	key: ProcessorProviderKey,
	text: string,
): Promise<ArrayBuffer> {
	const voiceName = key.modelId?.trim() || DEFAULT_GOOGLE_VOICE;
	const url = `${GOOGLE_TTS_BASE}?key=${encodeURIComponent(key.secret)}`;
	const res = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			input: { text },
			voice: { languageCode: "en-US", name: voiceName },
			audioConfig: { audioEncoding: "MP3" },
		}),
		signal: AbortSignal.timeout(120_000),
	});
	if (!res.ok)
		throw makeHttpErr(
			res.status,
			await res.text().catch(() => ""),
			res.headers.get("retry-after"),
		);
	const json = (await res.json()) as { audioContent?: string };
	if (!json.audioContent) throw new Error("google_tts_empty");
	const buf = Buffer.from(json.audioContent, "base64");
	return buf.buffer.slice(
		buf.byteOffset,
		buf.byteOffset + buf.byteLength,
	) as ArrayBuffer;
}

async function unrealStream(
	apiKey: string,
	text: string,
	voice: string,
): Promise<ArrayBuffer> {
	const res = await fetch(`${UNREAL_SPEECH_BASE}/stream`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify({
			Text: text,
			VoiceId: voice,
			Bitrate: "192k",
			Codec: "libmp3lame",
		}),
		signal: AbortSignal.timeout(30_000),
	});
	if (!res.ok)
		throw makeHttpErr(
			res.status,
			await res.text().catch(() => ""),
			res.headers.get("retry-after"),
		);
	return res.arrayBuffer();
}

async function unrealAsync(
	apiKey: string,
	text: string,
	voice: string,
): Promise<ArrayBuffer> {
	const res = await fetch(`${UNREAL_SPEECH_BASE}/speech`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify({ Text: text, VoiceId: voice, Bitrate: "192k" }),
		signal: AbortSignal.timeout(60_000),
	});
	if (!res.ok)
		throw makeHttpErr(
			res.status,
			await res.text().catch(() => ""),
			res.headers.get("retry-after"),
		);
	const json = (await res.json()) as { OutputUri?: string };
	if (!json.OutputUri) throw new Error("unreal_speech_no_output_uri");
	const audioRes = await fetch(json.OutputUri, {
		signal: AbortSignal.timeout(60_000),
	});
	if (!audioRes.ok)
		throw new Error(`unreal_speech_download_${audioRes.status}`);
	return audioRes.arrayBuffer();
}

async function unrealSpeechTts(
	key: ProcessorProviderKey,
	text: string,
	voice: string,
): Promise<ArrayBuffer> {
	const v = key.modelId?.trim() || voice;
	return text.length <= STREAM_CHAR_LIMIT
		? unrealStream(key.secret, text, v)
		: unrealAsync(key.secret, text, v);
}

/** TTS synthesis: Google Cloud TTS (primary) → Unreal Speech (fallback). */
export async function synthesizeSpeech(
	spec: ProcessorJobSpec,
	text: string,
): Promise<ArrayBuffer> {
	let lastError: unknown;

	for (const key of spec.providerKeys.googleTts) {
		try {
			return await withTiming("tts-gen", "google_tts.call", () =>
				googleTts(key, text),
			);
		} catch (e) {
			lastError = e;
			if (isHttpErr(e)) {
				await reportKeyFailure(
					spec,
					"google_tts",
					key.id,
					e.httpStatus,
					e.bodySnippet,
					e.retryAfterHeader,
				);
				continue;
			}
			throw e;
		}
	}

	for (const key of spec.providerKeys.unrealSpeech) {
		try {
			return await withTiming("tts-gen", "unreal_speech.call", () =>
				unrealSpeechTts(key, text, spec.ttsVoice),
			);
		} catch (e) {
			lastError = e;
			if (isHttpErr(e)) {
				await reportKeyFailure(
					spec,
					"unreal_speech",
					key.id,
					e.httpStatus,
					e.bodySnippet,
					e.retryAfterHeader,
				);
				continue;
			}
			throw e;
		}
	}

	throw lastError ?? new Error("tts_all_providers_failed");
}
