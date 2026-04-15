import type {
	ProcessorJobSpec,
	ProcessorProviderKey,
} from "@klipse/video-assembly-shared";
import { reportKeyFailure } from "../utils/callbacks";
import { sleep } from "../utils/retry";

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const REPLICATE_BASE = "https://api.replicate.com/v1";
const FLUX_SCHNELL_MODEL = "black-forest-labs/flux-schnell";
const MAX_BURST_RETRIES = 4;

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

async function openRouterImage(
	key: ProcessorProviderKey,
	model: string,
	prompt: string,
	aspectRatio: string,
): Promise<ArrayBuffer> {
	const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${key.secret}`,
			"X-Title": "Klipse",
		},
		body: JSON.stringify({
			model,
			modalities: ["image"],
			image_config: { aspect_ratio: aspectRatio },
			messages: [{ role: "user", content: prompt }],
		}),
		signal: AbortSignal.timeout(300_000),
	});
	if (!res.ok)
		throw makeHttpErr(
			res.status,
			await res.text().catch(() => ""),
			res.headers.get("retry-after"),
		);
	const json = (await res.json()) as {
		choices?: { message?: { images?: { image_url?: { url?: string } }[] } }[];
		error?: { message?: string };
	};
	if (json.error?.message)
		throw new Error(`openrouter_image_error: ${json.error.message}`);
	const dataUrl = json.choices?.[0]?.message?.images?.[0]?.image_url?.url;
	if (!dataUrl) throw new Error("openrouter_image_empty");
	const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
	if (!base64) throw new Error("openrouter_image_invalid_data_url");
	const buf = Buffer.from(base64, "base64");
	return buf.buffer.slice(
		buf.byteOffset,
		buf.byteOffset + buf.byteLength,
	) as ArrayBuffer;
}

async function replicateImage(
	key: ProcessorProviderKey,
	prompt: string,
	aspectRatio: string,
): Promise<ArrayBuffer> {
	const modelId = key.modelId?.trim() || FLUX_SCHNELL_MODEL;
	for (let attempt = 0; ; attempt++) {
		const res = await fetch(`${REPLICATE_BASE}/predictions`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${key.secret}`,
				Prefer: "wait=60",
			},
			body: JSON.stringify({
				version: modelId,
				input: {
					prompt,
					aspect_ratio: aspectRatio,
					output_format: "webp",
					output_quality: 85,
					num_outputs: 1,
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

/** Generates one image: tries OpenRouter keys first, then Replicate. */
export async function generateImage(
	spec: ProcessorJobSpec,
	prompt: string,
): Promise<ArrayBuffer> {
	const aspectRatio = spec.aspectRatio ?? "16:9";
	const imageModel = spec.openrouterImageModel;
	let lastError: unknown;

	for (const key of spec.providerKeys.openrouter) {
		try {
			return await openRouterImage(key, imageModel, prompt, aspectRatio);
		} catch (e) {
			lastError = e;
			if (isHttpErr(e)) {
				await reportKeyFailure(
					spec,
					"openrouter",
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

	for (const key of spec.providerKeys.replicate) {
		try {
			return await replicateImage(key, prompt, aspectRatio);
		} catch (e) {
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
				continue;
			}
			throw e;
		}
	}

	throw lastError ?? new Error("image_generation_all_failed");
}
