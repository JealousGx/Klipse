import "@tanstack/react-start/server-only";

import type { ProcessorProviderKeys } from "@klipse/video-assembly-shared";

import { listProviderApiKeyCredentials } from "./provider-api-keys.server";

/**
 * Fetches all active provider keys from DB and bundles them for `ProcessorJobSpec`.
 * The processor tries keys in the returned order, reporting failures back via callback.
 */
export async function bundleProviderKeysForProcessor(): Promise<ProcessorProviderKeys> {
	const [openrouter, googleTts, replicate, unrealSpeech, elevenlabs] =
		await Promise.all([
			listProviderApiKeyCredentials("openrouter"),
			listProviderApiKeyCredentials("google_tts"),
			listProviderApiKeyCredentials("replicate"),
			listProviderApiKeyCredentials("unreal_speech"),
			listProviderApiKeyCredentials("elevenlabs"),
		]);

	return {
		openrouter: openrouter.map((k) => ({
			id: k.id,
			secret: k.secret,
			modelId: k.modelId,
		})),
		googleTts: googleTts.map((k) => ({
			id: k.id,
			secret: k.secret,
			modelId: k.modelId,
		})),
		replicate: replicate.map((k) => ({
			id: k.id,
			secret: k.secret,
			modelId: k.modelId,
		})),
		unrealSpeech: unrealSpeech.map((k) => ({
			id: k.id,
			secret: k.secret,
			modelId: k.modelId,
		})),
		elevenlabs: elevenlabs.map((k) => ({
			id: k.id,
			secret: k.secret,
			modelId: k.modelId,
		})),
	};
}
