import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import { InsufficientCreditsError } from "@/features/billing/credit-usage.server";
import { auth } from "@/lib/auth";

import { ChannelNotFoundError } from "@/features/channels/channel-errors";

import { executeStubGenerateWithIdempotency } from "./stub-generate-execute.server";

export { estimateStubGenerateCredits } from "./stub-generate-cost";

const runStubGenerateInputSchema = z.object({
	channelId: z.string().trim().min(1).max(64),
	idempotencyKey: z.string().trim().min(8).max(128),
});

export type RunStubGenerateResult =
	| {
			ok: true;
			creditsRemaining: number;
			ref: string;
			creditsCharged: number;
			replayed: boolean;
	  }
	| {
			ok: false;
			code: "unauthorized";
	  }
	| {
			ok: false;
			code: "insufficient_credits";
			required: number;
			remaining: number;
	  }
	| { ok: false; code: "channel_not_found" };

export const runStubGenerate = createServerFn({ method: "POST" })
	.inputValidator((raw: unknown) => runStubGenerateInputSchema.parse(raw))
	.handler(async ({ data }): Promise<RunStubGenerateResult> => {
		const request = getRequest();
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) {
			return { ok: false, code: "unauthorized" };
		}

		try {
			const outcome = await executeStubGenerateWithIdempotency({
				userId: session.user.id,
				channelId: data.channelId,
				idempotencyKey: data.idempotencyKey,
			});

			const replayed = outcome.kind === "replay";

			return {
				ok: true,
				creditsRemaining: outcome.payload.creditsRemaining,
				ref: outcome.payload.ref,
				creditsCharged: outcome.payload.creditsCharged,
				replayed,
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
			throw e;
		}
	});
