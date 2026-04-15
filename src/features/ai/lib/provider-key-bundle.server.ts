import "@tanstack/react-start/server-only";

import type { ProcessorProviderKeys } from "@klipse/video-assembly-shared";

import { listAllProcessorProviderKeyCredentials } from "./provider-api-keys.server";

/**
 * Fetches all active provider keys from DB in two queries (grouped count + bulk SELECT)
 * and bundles them for `ProcessorJobSpec`. Previously made five parallel DB calls.
 */
export async function bundleProviderKeysForProcessor(): Promise<ProcessorProviderKeys> {
	const all = await listAllProcessorProviderKeyCredentials();

	return {
		openrouter: all.openrouter.map((k) => ({
			id: k.id,
			secret: k.secret,
			modelId: k.modelId,
		})),
		gemini: all.gemini.map((k) => ({
			id: k.id,
			secret: k.secret,
			modelId: k.modelId,
		})),
		googleTts: all.google_tts.map((k) => ({
			id: k.id,
			secret: k.secret,
			modelId: k.modelId,
		})),
		replicate: all.replicate.map((k) => ({
			id: k.id,
			secret: k.secret,
			modelId: k.modelId,
		})),
		unrealSpeech: all.unreal_speech.map((k) => ({
			id: k.id,
			secret: k.secret,
			modelId: k.modelId,
		})),
		elevenlabs: all.elevenlabs.map((k) => ({
			id: k.id,
			secret: k.secret,
			modelId: k.modelId,
		})),
	};
}
