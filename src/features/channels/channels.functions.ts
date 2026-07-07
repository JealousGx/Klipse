import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

import {
	reconcileAllYoutubeOAuthForUser,
	reconcileYoutubeOAuthForUserChannel,
} from "@/features/youtube/youtube-oauth-reconcile.server"

import { withAuth } from "@/middleware/with-auth"

import { channelConfigSchema } from "./channel-config.schema"
import {
	ChannelLimitError,
	ChannelNotFoundError,
	createChannel,
	deleteChannel,
	disconnectChannelOAuth,
	ensureDefaultPublishingDestination,
	getChannelForUser,
	listChannelsForUser,
	updateChannel,
} from "./channels.service.server"
import {
	publishingPlatformSchema,
	youtubeChannelIdSchema,
} from "./external-channel.schema"

const createInput = z.object({
	name: z.string().trim().min(1).max(255),
	niche: z.string().trim().min(1).max(512),
	config: channelConfigSchema.optional(),
})

const idParam = z.object({
	channelId: z.string().trim().min(1).max(64),
})

const reconcileYoutubeInput = z.object({
	channelId: z.string().trim().min(1).max(64).optional(),
})

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
	)

export type ChannelsListResult =
	| { ok: true; channels: Awaited<ReturnType<typeof listChannelsForUser>> }
	| { ok: false; code: "unauthorized" }

export const listChannelsFn = createServerFn({ method: "GET" })
	.middleware([withAuth])
	.handler(async ({ context }): Promise<ChannelsListResult> => {
		await ensureDefaultPublishingDestination(context.user.id)
		const channelsList = await listChannelsForUser(context.user.id)
		return { ok: true, channels: channelsList }
	})

export type ChannelGetResult =
	| {
			ok: true
			channel: NonNullable<Awaited<ReturnType<typeof getChannelForUser>>>
	  }
	| { ok: false; code: "unauthorized" | "not_found" }

export type ReconcileYoutubeOAuthResult =
	| { ok: true; revokedChannelIds: string[] }
	| { ok: false; code: "unauthorized" }

/**
 * Probes stored Google refresh tokens. If Google returns `invalid_grant` (user
 * removed app access in their Google Account), clears the refresh token for
 * that destination so the UI prompts to reconnect.
 */
export const reconcileYoutubeOAuthFn = createServerFn({ method: "POST" })
	.middleware([withAuth])
	.inputValidator((raw: unknown) => reconcileYoutubeInput.parse(raw ?? {}))
	.handler(async ({ context, data }): Promise<ReconcileYoutubeOAuthResult> => {
		if (data.channelId) {
			const outcome = await reconcileYoutubeOAuthForUserChannel({
				userId: context.user.id,
				channelId: data.channelId,
			})
			return {
				ok: true,
				revokedChannelIds: outcome === "revoked" ? [data.channelId] : [],
			}
		}
		const { revokedChannelIds } = await reconcileAllYoutubeOAuthForUser(
			context.user.id,
		)
		return { ok: true, revokedChannelIds }
	})

export const getChannelFn = createServerFn({ method: "POST" })
	.middleware([withAuth])
	.inputValidator((raw: unknown) => idParam.parse(raw))
	.handler(async ({ context, data }): Promise<ChannelGetResult> => {
		const channel = await getChannelForUser(context.user.id, data.channelId)
		if (!channel) {
			return { ok: false, code: "not_found" }
		}
		return { ok: true, channel }
	})

export type ChannelMutationResult =
	| { ok: true; channel: Awaited<ReturnType<typeof createChannel>> }
	| {
			ok: false
			code: "unauthorized" | "channel_limit" | "validation"
			message?: string
	  }

export const createChannelFn = createServerFn({ method: "POST" })
	.middleware([withAuth])
	.inputValidator((raw: unknown) => createInput.parse(raw))
	.handler(async ({ context, data }): Promise<ChannelMutationResult> => {
		try {
			const channel = await createChannel({
				userId: context.user.id,
				name: data.name,
				niche: data.niche,
				config: data.config,
			})
			return { ok: true, channel }
		} catch (e) {
			if (e instanceof ChannelLimitError) {
				return {
					ok: false,
					code: "channel_limit",
					message: e.message,
				}
			}
			throw e
		}
	})

export const updateChannelFn = createServerFn({ method: "POST" })
	.middleware([withAuth])
	.inputValidator((raw: unknown) => updateInput.parse(raw))
	.handler(async ({ context, data }): Promise<ChannelMutationResult> => {
		try {
			let externalChannelId = data.externalChannelId
			if (externalChannelId !== undefined && externalChannelId !== null) {
				const t = externalChannelId.trim()
				externalChannelId = t === "" ? null : t
			}
			let platform = data.platform
			if (externalChannelId !== undefined && externalChannelId !== null) {
				youtubeChannelIdSchema.parse(externalChannelId)
				if (platform === undefined) {
					platform = "youtube"
				}
			}

			const channel = await updateChannel({
				userId: context.user.id,
				channelId: data.channelId,
				name: data.name,
				niche: data.niche,
				config: data.config,
				platform,
				externalChannelId,
				externalChannelTitle: data.externalChannelTitle,
				externalChannelHandle: data.externalChannelHandle,
			})
			return { ok: true, channel }
		} catch (e) {
			if (e instanceof ChannelNotFoundError) {
				return { ok: false, code: "validation", message: e.message }
			}
			if (e instanceof z.ZodError) {
				const first = e.issues[0]
				return {
					ok: false,
					code: "validation",
					message: first?.message ?? "Validation failed.",
				}
			}
			throw e
		}
	})

export type DisconnectChannelResult =
	| { ok: true }
	| { ok: false; code: "unauthorized" | "not_found" }

export const disconnectChannelFn = createServerFn({ method: "POST" })
	.middleware([withAuth])
	.inputValidator((raw: unknown) => idParam.parse(raw))
	.handler(async ({ context, data }): Promise<DisconnectChannelResult> => {
		try {
			await disconnectChannelOAuth({
				userId: context.user.id,
				channelId: data.channelId,
			})
			return { ok: true }
		} catch (e) {
			if (e instanceof ChannelNotFoundError) {
				return { ok: false, code: "not_found" }
			}
			throw e
		}
	})

export type DeleteChannelResult =
	| { ok: true }
	| { ok: false; code: "unauthorized" | "not_found" }

export const deleteChannelFn = createServerFn({ method: "POST" })
	.middleware([withAuth])
	.inputValidator((raw: unknown) => idParam.parse(raw))
	.handler(async ({ context, data }): Promise<DeleteChannelResult> => {
		try {
			await deleteChannel({
				userId: context.user.id,
				channelId: data.channelId,
			})
			return { ok: true }
		} catch (e) {
			if (e instanceof ChannelNotFoundError) {
				return { ok: false, code: "not_found" }
			}
			throw e
		}
	})
