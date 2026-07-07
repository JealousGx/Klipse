import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useCallback } from "react"
import { toast } from "sonner"

import type { ChannelConfig } from "@/features/channels/channel-config.schema"
import {
	deleteChannelFn,
	disconnectChannelFn,
	updateChannelFn,
} from "@/features/channels/channels.functions"

import { usePublishingScheduleMutations } from "./use-publishing-schedule-mutations"

export function usePublishingDestinationMutations(
	destinationId: string,
	{
		displayName,
		niche,
		setAutoPost,
		setFrequency,
	}: {
		displayName: string
		niche: string
		setAutoPost: (v: boolean) => void
		setFrequency: (v: ChannelConfig["posting_frequency"]) => void
	},
) {
	const navigate = useNavigate()
	const queryClient = useQueryClient()

	const scheduleMutations = usePublishingScheduleMutations(destinationId)

	const deleteMutation = useMutation({
		mutationFn: async () => {
			return deleteChannelFn({ data: { channelId: destinationId } })
		},
		onSuccess: (r) => {
			if (r.ok) {
				toast.success("Destination removed")
				void queryClient.invalidateQueries({ queryKey: ["channels"] })
				void navigate({ to: "/dashboard/publishing" })
				return
			}
			toast.error("Couldn't remove destination")
		},
		onError: () => {
			toast.error("Couldn't remove destination")
		},
	})

	const updateProfileMutation = useMutation({
		mutationFn: async () => {
			return updateChannelFn({
				data: {
					channelId: destinationId,
					name: displayName.trim(),
					niche: niche.trim(),
				},
			})
		},
		onSuccess: (r) => {
			if (r.ok) {
				toast.success("Destination updated")
				void queryClient.invalidateQueries({
					queryKey: ["channel", destinationId],
				})
				void queryClient.invalidateQueries({ queryKey: ["channels"] })
				return
			}
			toast.error(r.message ?? "Could not save")
		},
		onError: (err) => {
			console.error("Error in updateProfileMutation", err)
			const errorMessage =
				Array.isArray(err) && err[0]
					? (err[0] as { message?: string })?.message
					: null
			toast.error(errorMessage ?? "Could not save")
		},
	})

	const updateAutoPostMutation = useMutation({
		mutationFn: async (nextAutoPost: boolean) => {
			const c = queryClient.getQueryData(["channel", destinationId]) as
				| { config: ChannelConfig }
				| undefined
			if (!c) throw new Error("Channel not loaded")
			return updateChannelFn({
				data: {
					channelId: destinationId,
					config: { ...c.config, auto_post: nextAutoPost },
				},
			})
		},
		onSuccess: (r) => {
			if (r.ok) {
				setAutoPost(r.channel.config.auto_post)
				toast.success("Publishing preference saved")
				void queryClient.invalidateQueries({
					queryKey: ["channel", destinationId],
				})
				void queryClient.invalidateQueries({ queryKey: ["channels"] })
				return
			}
			toast.error(r.message ?? "Could not save")
		},
		onError: (err) => {
			const errorMessage =
				Array.isArray(err) && err[0]
					? (err[0] as { message?: string })?.message
					: null
			toast.error(errorMessage ?? "Could not save")
		},
	})

	const updateFrequencyMutation = useMutation({
		mutationFn: async (newFrequency: ChannelConfig["posting_frequency"]) => {
			const c = queryClient.getQueryData(["channel", destinationId]) as
				| { config: ChannelConfig }
				| undefined
			if (!c) throw new Error("Channel not loaded")
			return updateChannelFn({
				data: {
					channelId: destinationId,
					config: { ...c.config, posting_frequency: newFrequency },
				},
			})
		},
		onSuccess: (r, newFrequency) => {
			if (r.ok) {
				setFrequency(newFrequency)
				toast.success("Posting frequency updated")
				void queryClient.invalidateQueries({
					queryKey: ["channel", destinationId],
				})
				void queryClient.invalidateQueries({
					queryKey: ["schedule", destinationId],
				})
				return
			}
			toast.error(r.message ?? "Could not save")
		},
		onError: (err) => {
			const errorMessage =
				Array.isArray(err) && err[0]
					? (err[0] as { message?: string })?.message
					: null
			toast.error(errorMessage ?? "Could not save")
		},
	})

	const oauthDisconnectMutation = useMutation({
		mutationFn: async () =>
			disconnectChannelFn({ data: { channelId: destinationId } }),
		onSuccess: (r) => {
			if (r.ok) {
				toast.success("Publishing account disconnected")
				void queryClient.invalidateQueries({
					queryKey: ["channel", destinationId],
				})
				void queryClient.invalidateQueries({ queryKey: ["channels"] })
				return
			}
			toast.error("Could not disconnect. Try again.")
		},
		onError: () => toast.error("Could not disconnect. Try again."),
	})

	const handleDisconnect = useCallback(() => {
		if (
			typeof window !== "undefined" &&
			!window.confirm(
				"Disconnect this publishing account? Access is removed. You can reconnect later, but only with the same channel that was first linked to this destination.",
			)
		) {
			return
		}
		oauthDisconnectMutation.mutate()
	}, [oauthDisconnectMutation])

	const handleRemoveClick = useCallback(() => {
		if (
			typeof window !== "undefined" &&
			!window.confirm(
				"Remove this publishing destination? Associated jobs in the database may be deleted.",
			)
		) {
			return
		}
		deleteMutation.mutate()
	}, [deleteMutation])

	return {
		deleteMutation,
		updateProfileMutation,
		updateAutoPostMutation,
		updateFrequencyMutation,
		oauthDisconnectMutation,
		...scheduleMutations,
		handleDisconnect,
		handleRemoveClick,
	}
}
