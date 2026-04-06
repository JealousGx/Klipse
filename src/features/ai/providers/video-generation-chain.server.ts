import "@tanstack/react-start/server-only";

import { createKlingTextToVideo } from "./kling-video.server";
import {
	createLumaTextToVideo,
	waitForLumaCompletion,
} from "./luma-video.server";
import { fetchPollinationsVideo } from "./pollinations-video.server";

export type VideoGenerationSource = "pollinations" | "kling" | "luma";

/**
 * Video: Pollinations (Wan-Fast) → Kling 3.0 → Luma.
 * Future premium order: branch on `resolveAiRoutingTier` in `ai-routing-policy.server.ts`.
 */
export async function generateVideoWithFallback(input: {
	prompt: string;
	durationSec?: number;
}): Promise<
	| { source: "pollinations"; buffer: ArrayBuffer }
	| { source: "kling"; task: unknown }
	| {
			source: "luma";
			generation: Awaited<ReturnType<typeof createLumaTextToVideo>>;
	  }
> {
	try {
		const buffer = await fetchPollinationsVideo({
			prompt: input.prompt,
			durationSec: input.durationSec,
		});
		return { source: "pollinations", buffer };
	} catch {
		// continue
	}

	try {
		const task = await createKlingTextToVideo({
			prompt: input.prompt,
			duration: input.durationSec ?? 5,
		});
		return { source: "kling", task };
	} catch {
		// continue
	}

	try {
		const gen = await createLumaTextToVideo({ prompt: input.prompt });
		if (gen.state === "completed" && gen.assets?.video) {
			return { source: "luma", generation: gen };
		}
		const done = await waitForLumaCompletion(gen.id);
		return { source: "luma", generation: done };
	} catch {
		throw new Error("video_generation_all_providers_failed");
	}
}
