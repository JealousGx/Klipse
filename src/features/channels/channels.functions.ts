import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import { auth } from "@/lib/auth";

import { channelConfigSchema } from "./channel-config.schema";
import {
	publishingPlatformSchema,
	youtubeChannelIdSchema,
} from "./external-channel.schema";
import {
	ChannelLimitError,
	ChannelNotFoundError,
	createChannel,
	deleteChannel,
	ensureDefaultPublishingDestination,
	getChannelForUser,
	listChannelsForUser,
	updateChannel,
} from "./channels.service.server";

const createInput = z.object({
	name: z.string().trim().min(1).max(255),
	niche: z.string().trim().min(1).max(512),
	config: channelConfigSchema.optional(),
});

const idParam = z.object({
	channelId: z.string().trim().min(1).max(64),
});

const updateInput = z
	.object({
		channelId: z.string().trim().min(1).max(64),
		name: z.string().trim().min(1).max(255).optional(),
		niche: z.string().trim().min(1).max(512).optional(),
		config: channelConfigSchema.optional(),
		platform: publishingPlatformSchema.optional(),
		externalChannelId: z.union([z.string(), z.null()]).optional(),
		externalChannelTitle: z.union([z.string(), z.null()]).optional(),
		externalChannelHandle: z.union([z.string(), z.null()]).optional(),
	})
	.refine(
		(d) =>
			d.name !== undefined ||
			d.niche !== undefined ||
			d.config !== undefined ||
			d.platform !== undefined ||
			d.externalChannelId !== undefined ||
			d.externalChannelTitle !== undefined ||
			d.externalChannelHandle !== undefined,
		{
			message:
				"Provide at least one field to update (including platform link fields).",
		},
	);

export type ChannelsListResult =
	| { ok: true; channels: Awaited<ReturnType<typeof listChannelsForUser>> }
	| { ok: false; code: "unauthorized" };

export const listChannelsFn = createServerFn({ method: "GET" }).handler(
	async (): Promise<ChannelsListResult> => {
		const request = getRequest();
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) {
			return { ok: false, code: "unauthorized" };
		}
		await ensureDefaultPublishingDestination(session.user.id);
		const channelsList = await listChannelsForUser(session.user.id);
		return { ok: true, channels: channelsList };
	},
);

export type ChannelGetResult =
	| {
			ok: true;
			channel: NonNullable<Awaited<ReturnType<typeof getChannelForUser>>>;
	  }
	| { ok: false; code: "unauthorized" | "not_found" };

export const getChannelFn = createServerFn({ method: "POST" })
	.inputValidator((raw: unknown) => idParam.parse(raw))
	.handler(async ({ data }): Promise<ChannelGetResult> => {
		const request = getRequest();
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) {
			return { ok: false, code: "unauthorized" };
		}
		const channel = await getChannelForUser(session.user.id, data.channelId);
		if (!channel) {
			return { ok: false, code: "not_found" };
		}
		return { ok: true, channel };
	});

export type ChannelMutationResult =
	| { ok: true; channel: Awaited<ReturnType<typeof createChannel>> }
	| {
			ok: false;
			code: "unauthorized" | "channel_limit" | "validation";
			message?: string;
	  };

export const createChannelFn = createServerFn({ method: "POST" })
	.inputValidator((raw: unknown) => createInput.parse(raw))
	.handler(async ({ data }): Promise<ChannelMutationResult> => {
		const request = getRequest();
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) {
			return { ok: false, code: "unauthorized" };
		}
		try {
			const channel = await createChannel({
				userId: session.user.id,
				name: data.name,
				niche: data.niche,
				config: data.config,
			});
			return { ok: true, channel };
		} catch (e) {
			if (e instanceof ChannelLimitError) {
				return {
					ok: false,
					code: "channel_limit",
					message: e.message,
				};
			}
			throw e;
		}
	});

export const updateChannelFn = createServerFn({ method: "POST" })
	.inputValidator((raw: unknown) => updateInput.parse(raw))
	.handler(async ({ data }): Promise<ChannelMutationResult> => {
		const request = getRequest();
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) {
			return { ok: false, code: "unauthorized" };
		}
		try {
			let externalChannelId = data.externalChannelId;
			if (externalChannelId !== undefined && externalChannelId !== null) {
				const t = externalChannelId.trim();
				externalChannelId = t === "" ? null : t;
			}
			let platform = data.platform;
			if (
				externalChannelId !== undefined &&
				externalChannelId !== null
			) {
				youtubeChannelIdSchema.parse(externalChannelId);
				if (platform === undefined) {
					platform = "youtube";
				}
			}

			const channel = await updateChannel({
				userId: session.user.id,
				channelId: data.channelId,
				name: data.name,
				niche: data.niche,
				config: data.config,
				platform,
				externalChannelId,
				externalChannelTitle: data.externalChannelTitle,
				externalChannelHandle: data.externalChannelHandle,
			});
			return { ok: true, channel };
		} catch (e) {
			if (e instanceof ChannelNotFoundError) {
				return { ok: false, code: "validation", message: e.message };
			}
			if (e instanceof z.ZodError) {
				const first = e.issues[0];
				return {
					ok: false,
					code: "validation",
					message: first?.message ?? "Validation failed.",
				};
			}
			throw e;
		}
	});

export type DeleteChannelResult =
	| { ok: true }
	| { ok: false; code: "unauthorized" | "not_found" };

export const deleteChannelFn = createServerFn({ method: "POST" })
	.inputValidator((raw: unknown) => idParam.parse(raw))
	.handler(async ({ data }): Promise<DeleteChannelResult> => {
		const request = getRequest();
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) {
			return { ok: false, code: "unauthorized" };
		}
		try {
			await deleteChannel({
				userId: session.user.id,
				channelId: data.channelId,
			});
			return { ok: true };
		} catch (e) {
			if (e instanceof ChannelNotFoundError) {
				return { ok: false, code: "not_found" };
			}
			throw e;
		}
	});
