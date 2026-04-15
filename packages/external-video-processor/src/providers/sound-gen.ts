import type {
	ProcessorJobSpec,
	ProcessorProviderKey,
} from "@klipse/video-assembly-shared";

import { reportKeyFailure } from "../utils/callbacks";

const ELEVENLABS_BASE = "https://api.elevenlabs.io/v1";

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

async function elevenLabsSound(
	key: ProcessorProviderKey,
	prompt: string,
	durationSeconds: number,
): Promise<ArrayBuffer> {
	const res = await fetch(`${ELEVENLABS_BASE}/sound-generation`, {
		method: "POST",
		headers: { "Content-Type": "application/json", "xi-api-key": key.secret },
		body: JSON.stringify({
			text: prompt,
			duration_seconds: durationSeconds,
			prompt_influence: 0.3,
		}),
		signal: AbortSignal.timeout(60_000),
	});
	if (!res.ok)
		throw makeHttpErr(
			res.status,
			await res.text().catch(() => ""),
			res.headers.get("retry-after"),
		);
	return res.arrayBuffer();
}

/**
 * Generates background sound via ElevenLabs.
 * Returns null when no prompt is set (sound disabled or not Creator+).
 * Swallows errors — sound is an enhancement, not required for video.
 */
export async function generateSound(
	spec: ProcessorJobSpec,
): Promise<ArrayBuffer | null> {
	if (!spec.soundPrompt) return null;
	if (spec.providerKeys.elevenlabs.length === 0) return null;

	let lastError: unknown;
	for (const key of spec.providerKeys.elevenlabs) {
		try {
			return await elevenLabsSound(
				key,
				spec.soundPrompt,
				spec.soundDurationSeconds,
			);
		} catch (e) {
			lastError = e;
			if (isHttpErr(e)) {
				await reportKeyFailure(
					spec,
					"elevenlabs",
					key.id,
					e.httpStatus,
					e.bodySnippet,
					e.retryAfterHeader,
				);
				continue;
			}
			// Non-HTTP error: log but don't rotate
			console.warn("[sound-gen] ElevenLabs error (non-rotating):", e);
			break;
		}
	}

	console.warn(
		"[sound-gen] Sound generation failed, skipping:",
		lastError instanceof Error ? lastError.message : lastError,
	);
	return null; // non-fatal: video continues without sound
}
