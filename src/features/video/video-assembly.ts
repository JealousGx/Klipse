import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import { InsufficientCreditsError } from "@/features/billing/credit-usage.server";
import { ChannelNotFoundError } from "@/features/channels/channel-errors";
import { auth } from "@/lib/auth";

import {
	executeVideoAssemblyWithIdempotency,
	FreeTierVideoQuotaExhaustedError,
} from "./video-assembly-execute.server";

export { estimateVideoAssemblyCredits } from "./video-assembly-estimate";

const inputSchema = z.object({
	channelId: z.string().trim().min(1).max(64),
	idempotencyKey: z.string().trim().min(8).max(128),
});

export type RunVideoAssemblyResult =
	| {
			ok: true;
			creditsRemaining: number;
			ref: string;
			creditsCharged: number;
			replayed: boolean;
			creditsConsumed: boolean;
	  }
	| { ok: false; code: "unauthorized" }
	| {
			ok: false;
			code: "insufficient_credits";
			required: number;
			remaining: number;
	  }
	| { ok: false; code: "channel_not_found" }
	| { ok: false; code: "free_tier_video_exhausted" };

export const runVideoAssembly = createServerFn({ method: "POST" })
	.inputValidator((raw: unknown) => inputSchema.parse(raw))
	.handler(async ({ data }): Promise<RunVideoAssemblyResult> => {
		const request = getRequest();
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) {
			return { ok: false, code: "unauthorized" };
		}

		try {
			const outcome = await executeVideoAssemblyWithIdempotency({
				userId: session.user.id,
				channelId: data.channelId,
				idempotencyKey: data.idempotencyKey,
			});

			const replayed = outcome.kind === "replay";
			const creditsConsumed = outcome.kind === "fresh";

			return {
				ok: true,
				creditsRemaining: outcome.payload.creditsRemaining,
				ref: outcome.payload.ref,
				creditsCharged: outcome.payload.creditsCharged,
				replayed,
				creditsConsumed,
			};
		} catch (e) {
			if (e instanceof InsufficientCreditsError) {
				return {
					ok: false,
					code: "insufficient_credits",
					required: e.required,
					remaining: e.remaining,
				};
			}
			if (e instanceof ChannelNotFoundError) {
				return { ok: false, code: "channel_not_found" };
			}
			if (e instanceof FreeTierVideoQuotaExhaustedError) {
				return { ok: false, code: "free_tier_video_exhausted" };
			}
			throw e;
		}
	});
