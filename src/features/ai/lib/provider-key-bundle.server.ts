import "@tanstack/react-start/server-only"

import type { ProcessorProviderKeys } from "@klipse/video-assembly-shared"

import { listAllProcessorProviderKeyCredentials } from "./provider-api-keys.server"

/**
 * Fetches active script-gen provider keys (openrouter + gemini fallback) from DB
 * and bundles them for `ProcessorJobSpec`. The processor only does script-gen + self-hosted
 * video generation now, so no image/TTS/sound provider keys are needed.
 */
export async function bundleProviderKeysForProcessor(): Promise<ProcessorProviderKeys> {
	const all = await listAllProcessorProviderKeyCredentials()

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
	}
}
