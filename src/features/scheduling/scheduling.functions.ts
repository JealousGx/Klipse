import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import { auth } from "@/lib/auth";

import {
	getScheduleForChannel,
	pauseScheduleForChannel,
	resumeScheduleForChannel,
	triggerScheduleNowForChannel,
} from "./scheduling.service.server";

const channelIdSchema = z.object({
	channelId: z.string().trim().min(1).max(64),
});

export type GetChannelScheduleResult =
	| { ok: true; schedule: Awaited<ReturnType<typeof getScheduleForChannel>> }
	| { ok: false; code: "unauthorized" };

export const getChannelScheduleFn = createServerFn({ method: "GET" })
	.inputValidator((raw: unknown) => channelIdSchema.parse(raw))
	.handler(async ({ data }): Promise<GetChannelScheduleResult> => {
		const request = getRequest();
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) {
			return { ok: false, code: "unauthorized" };
		}
		const schedule = await getScheduleForChannel(
			session.user.id,
			data.channelId,
		);
		return { ok: true, schedule };
	});

export type ToggleScheduleResult =
	| { ok: true }
	| { ok: false; code: "unauthorized" };

export const pauseScheduleFn = createServerFn({ method: "POST" })
	.inputValidator((raw: unknown) => channelIdSchema.parse(raw))
	.handler(async ({ data }): Promise<ToggleScheduleResult> => {
		const request = getRequest();
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) {
			return { ok: false, code: "unauthorized" };
		}
		await pauseScheduleForChannel(session.user.id, data.channelId);
		return { ok: true };
	});

export const resumeScheduleFn = createServerFn({ method: "POST" })
	.inputValidator((raw: unknown) => channelIdSchema.parse(raw))
	.handler(async ({ data }): Promise<ToggleScheduleResult> => {
		const request = getRequest();
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) {
			return { ok: false, code: "unauthorized" };
		}
		await resumeScheduleForChannel(session.user.id, data.channelId);
		return { ok: true };
	});

export type TriggerScheduleNowResult =
	| { ok: true }
	| { ok: false; code: "unauthorized" | "plan_required" | "no_schedule" | "insufficient_credits" | "error" };

export const triggerScheduleNowFn = createServerFn({ method: "POST" })
	.inputValidator((raw: unknown) => channelIdSchema.parse(raw))
	.handler(async ({ data }): Promise<TriggerScheduleNowResult> => {
		const request = getRequest();
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) {
			return { ok: false, code: "unauthorized" };
		}
		const plan = (session.user as { plan?: string }).plan ?? "free";
		if (plan !== "creator" && plan !== "empire") {
			return { ok: false, code: "plan_required" };
		}
		const result = await triggerScheduleNowForChannel(
			session.user.id,
			data.channelId,
		);
		if (!result.ok) {
			return { ok: false, code: result.code };
		}
		return { ok: true };
	});
