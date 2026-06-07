import { createServerFn } from "@tanstack/react-start"
import { getRequest } from "@tanstack/react-start/server"
import { z } from "zod"

import { auth } from "@/lib/auth"

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
	.inputValidator((raw: unknown) => getOptionsInput.parse(raw))
	.handler(async ({ data }): Promise<TiktokPublishOptionsResult> => {
		const request = getRequest()
		const session = await auth.api.getSession({ headers: request.headers })
		if (!session?.user) {
			return { ok: false, code: "unauthorized" }
		}
		return getTiktokPublishOptions(session.user.id, data.channelId)
	})
