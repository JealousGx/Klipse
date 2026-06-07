import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

import { withAuth } from "@/middleware/with-auth"

import {
	getScheduleForChannel,
	pauseScheduleForChannel,
	resumeScheduleForChannel,
	triggerScheduleNowForChannel,
} from "./scheduling.service.server"

const channelIdSchema = z.object({
	channelId: z.string().trim().min(1).max(64),
})

export type GetChannelScheduleResult =
	| { ok: true; schedule: Awaited<ReturnType<typeof getScheduleForChannel>> }
	| { ok: false; code: "unauthorized" }

export const getChannelScheduleFn = createServerFn({ method: "GET" })
	.middleware([withAuth])
	.inputValidator((raw: unknown) => channelIdSchema.parse(raw))
	.handler(async ({ context, data }): Promise<GetChannelScheduleResult> => {
		const schedule = await getScheduleForChannel(
			context.user.id,
			data.channelId,
		)
		return { ok: true, schedule }
	})

export type ToggleScheduleResult =
	| { ok: true }
	| { ok: false; code: "unauthorized" }

export const pauseScheduleFn = createServerFn({ method: "POST" })
	.middleware([withAuth])
	.inputValidator((raw: unknown) => channelIdSchema.parse(raw))
	.handler(async ({ context, data }): Promise<ToggleScheduleResult> => {
		await pauseScheduleForChannel(context.user.id, data.channelId)
		return { ok: true }
	})

export const resumeScheduleFn = createServerFn({ method: "POST" })
	.middleware([withAuth])
	.inputValidator((raw: unknown) => channelIdSchema.parse(raw))
	.handler(async ({ context, data }): Promise<ToggleScheduleResult> => {
		await resumeScheduleForChannel(context.user.id, data.channelId)
		return { ok: true }
	})

export type TriggerScheduleNowResult =
	| { ok: true }
	| {
			ok: false
			code:
				| "unauthorized"
				| "plan_required"
				| "no_schedule"
				| "insufficient_credits"
				| "error"
	  }

export const triggerScheduleNowFn = createServerFn({ method: "POST" })
	.middleware([withAuth])
	.inputValidator((raw: unknown) => channelIdSchema.parse(raw))
	.handler(async ({ context, data }): Promise<TriggerScheduleNowResult> => {
		const plan = (context.user as { plan?: string }).plan ?? "free"
		if (plan !== "creator" && plan !== "empire") {
			return { ok: false, code: "plan_required" }
		}
		const result = await triggerScheduleNowForChannel(
			context.user.id,
			data.channelId,
		)
		if (!result.ok) {
			return { ok: false, code: result.code }
		}
		return { ok: true }
	})
