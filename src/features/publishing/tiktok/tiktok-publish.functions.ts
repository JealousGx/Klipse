import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

import { withAuth } from "@/middleware/with-auth"

import { getTiktokPublishOptions } from "./get-tiktok-publish-options.server"

const getOptionsInput = z.object({
	channelId: z.string().trim().min(1).max(64),
})

export type TiktokPublishOptionsResult =
	| {
			ok: true
			privacyLevelOptions: string[]
			creatorNickname: string
			creatorHandle: string
			maxVideoPostDurationSec: number
	  }
	| {
			ok: false
			code:
				| "unauthorized"
				| "no_token"
				| "token_invalid"
				| "post_cap_reached"
				| "fetch_failed"
	  }

export const getTiktokPublishOptionsFn = createServerFn({ method: "POST" })
	.middleware([withAuth])
	.inputValidator((raw: unknown) => getOptionsInput.parse(raw))
	.handler(async ({ context, data }): Promise<TiktokPublishOptionsResult> => {
		return getTiktokPublishOptions(context.user.id, data.channelId)
	})
