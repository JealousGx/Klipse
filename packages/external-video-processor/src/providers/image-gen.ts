import type {
	ProcessorJobSpec,
	ProcessorProviderKey,
} from "@klipse/video-assembly-shared";
import { reportKeyFailure } from "../utils/callbacks";
import { sleep } from "../utils/retry";

const REPLICATE_BASE = "https://api.replicate.com/v1";
const FLUX_SCHNELL_MODEL = "black-forest-labs/flux-schnell";
const MAX_BURST_RETRIES = 4;

/**
 * Explicit dimensions for models that use width/height instead of aspect_ratio (e.g. SDXL).
 * Chosen to match SDXL's optimal resolutions (multiples of 64).
 */
const ASPECT_DIMENSIONS: Record<string, [number, number]> = {
	"16:9": [1344, 768],
	"9:16": [768, 1344],
	"1:1": [1024, 1024],
};

/** Flux models use `aspect_ratio` string; all others (SDXL, etc.) use `width`/`height`. */
function isFluxModel(modelId: string): boolean {
	return /\bflux\b/i.test(modelId);
}

/**
 * A modelId containing "/" is a model name (owner/name) — use the models endpoint.
 * A plain hash string uses the versions endpoint.
 */
function replicateEndpoint(modelId: string): string {
	return modelId.includes("/")
		? `${REPLICATE_BASE}/models/${modelId}/predictions`
		: `${REPLICATE_BASE}/predictions`;
}

function isHttpErr(e: unknown): e is Error & {
	httpStatus: number;
	bodySnippet: string;
	retryAfterHeader: string | null;
} {
	return e instanceof Error && "httpStatus" in e;
}

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

async function replicateImage(
	key: ProcessorProviderKey,
	prompt: string,
	aspectRatio: string,
): Promise<ArrayBuffer> {
	const modelId = key.modelId?.trim() || FLUX_SCHNELL_MODEL;
	const isModelName = modelId.includes("/");
	const url = replicateEndpoint(modelId);
	const flux = isFluxModel(modelId);
	const [imgW, imgH] = ASPECT_DIMENSIONS[aspectRatio] ?? [1024, 1024];

	// Build model-specific input params.
	const imageParams = flux
		? { aspect_ratio: aspectRatio, output_format: "webp", output_quality: 85 }
		: {
				width: imgW,
				height: imgH,
				num_inference_steps: 30,
				guidance_scale: 7.5,
			};

	for (let attempt = 0; ; attempt++) {
		const res = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${key.secret}`,
				Prefer: "wait=60",
			},
			body: JSON.stringify({
				// version field only for hash-based calls; model-name calls don't need it
				...(isModelName ? {} : { version: modelId }),
				input: {
					prompt,
					negative_prompt:
						"nsfw, nudity, explicit, sexual content, inappropriate",
					num_outputs: 1,
					...imageParams,
				},
			}),
			signal: AbortSignal.timeout(90_000),
		});
		if (res.status === 429 && attempt < MAX_BURST_RETRIES) {
			const retryAfterSec = Number(res.headers.get("retry-after") ?? "0");
			const waitMs =
				retryAfterSec > 0
					? retryAfterSec * 1000
					: Math.min(1000 * 2 ** attempt, 16_000);
			await sleep(waitMs);
			continue;
		}
		if (!res.ok)
			throw makeHttpErr(
				res.status,
				await res.text().catch(() => ""),
				res.headers.get("retry-after"),
			);
		const pred = (await res.json()) as {
			status: string;
			output?: string[];
			error?: string;
			urls?: { get?: string };
		};
		if (pred.error) throw new Error(`replicate_error: ${pred.error}`);
		let outputUrl = pred.output?.[0];
		if (!outputUrl && pred.status !== "failed" && pred.urls?.get) {
			outputUrl = await pollReplicate(key.secret, pred.urls.get);
		}
		if (!outputUrl) throw new Error("replicate_no_output");
		const imgRes = await fetch(outputUrl, {
			signal: AbortSignal.timeout(60_000),
		});
		if (!imgRes.ok) throw new Error(`replicate_download_${imgRes.status}`);
		return imgRes.arrayBuffer();
	}
}

async function pollReplicate(secret: string, getUrl: string): Promise<string> {
	const deadline = Date.now() + 90_000;
	while (Date.now() < deadline) {
		await sleep(3000);
		const res = await fetch(getUrl, {
			headers: { Authorization: `Bearer ${secret}` },
			signal: AbortSignal.timeout(15_000),
		});
		if (!res.ok) throw new Error(`replicate_poll_${res.status}`);
		const d = (await res.json()) as {
			status: string;
			output?: string[];
			error?: string;
		};
		if (d.error) throw new Error(`replicate_error: ${d.error}`);
		if (d.status === "succeeded" && d.output?.[0]) return d.output[0];
		if (d.status === "failed") throw new Error("replicate_failed");
	}
	throw new Error("replicate_timeout");
}

function isNsfwError(e: unknown): boolean {
	return e instanceof Error && e.message.toLowerCase().includes("nsfw");
}

/**
 * Strips words that commonly trigger NSFW classifiers and appends artistic framing.
 * Applied on first NSFW rejection; if that also fails we propagate the error.
 */
function sanitizePrompt(prompt: string): string {
	const stripped = prompt
		.replace(
			/\b(nude|naked|sexy|intimate|sensual|erotic|exposed|revealing)\b/gi,
			"",
		)
		.replace(/\s{2,}/g, " ")
		.trim();
	return `${stripped}, cinematic, artistic, professional photography`;
}

/** Generates one image via Replicate (Flux Schnell default, SDXL configurable). */
export async function generateImage(
	spec: ProcessorJobSpec,
	prompt: string,
): Promise<ArrayBuffer> {
	const aspectRatio = spec.aspectRatio ?? "9:16";
	let lastError: unknown;

	for (const key of spec.providerKeys.replicate) {
		// Per key: try original prompt, then sanitized prompt on NSFW.
		let p = prompt;
		for (let nsfwAttempt = 0; nsfwAttempt <= 1; nsfwAttempt++) {
			try {
				return await replicateImage(key, p, aspectRatio);
			} catch (e) {
				if (isNsfwError(e) && nsfwAttempt === 0) {
					p = sanitizePrompt(prompt);
					continue; // retry same key with sanitized prompt
				}
				lastError = e;
				if (isHttpErr(e)) {
					await reportKeyFailure(
						spec,
						"replicate",
						key.id,
						e.httpStatus,
						e.bodySnippet,
						e.retryAfterHeader,
					);
				} else if (!isNsfwError(e)) {
					throw e;
				}
				break; // move to next key
			}
		}
	}

	throw lastError ?? new Error("image_generation_all_failed");
}
