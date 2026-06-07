import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import type {
	ChannelConfig,
	PlatformConfirmedTerm,
} from "@/features/channels/channel-config.schema"
import { updateChannelFn } from "@/features/channels/channels.functions"
import {
	pauseScheduleFn,
	resumeScheduleFn,
	triggerScheduleNowFn,
} from "@/features/scheduling/scheduling.functions"

export function usePublishingScheduleMutations(destinationId: string) {
	const queryClient = useQueryClient()

	const pauseScheduleMutation = useMutation({
		mutationFn: async () =>
			pauseScheduleFn({ data: { channelId: destinationId } }),
		onSuccess: (r) => {
			if (r.ok) {
				toast.success("Schedule paused")
				void queryClient.invalidateQueries({
					queryKey: ["schedule", destinationId],
				})
				return
			}
			toast.error("Sign in required.")
		},
		onError: () => toast.error("Something went wrong."),
	})

	const resumeScheduleMutation = useMutation({
		mutationFn: async () =>
			resumeScheduleFn({ data: { channelId: destinationId } }),
		onSuccess: (r) => {
			if (r.ok) {
				toast.success("Schedule resumed")
				void queryClient.invalidateQueries({
					queryKey: ["schedule", destinationId],
				})
				return
			}
			toast.error("Sign in required.")
		},
		onError: () => toast.error("Something went wrong."),
	})

	const triggerNowMutation = useMutation({
		mutationFn: async () =>
			triggerScheduleNowFn({ data: { channelId: destinationId } }),
		onSuccess: (r) => {
			if (r.ok) {
				toast.success("Video queued — check the Jobs page for progress.")
				void queryClient.invalidateQueries({
					queryKey: ["schedule", destinationId],
				})
				void queryClient.invalidateQueries({ queryKey: ["video-jobs"] })
				return
			}
			if (r.code === "insufficient_credits") {
				toast.error("Not enough credits. Add more under Billing.")
				return
			}
			if (r.code === "plan_required") {
				toast.error("Upgrade to Creator or higher to use this feature.")
				return
			}
			toast.error("Something went wrong. Please try again.")
		},
		onError: () => toast.error("Something went wrong."),
	})

	const updateTiktokDefaultsMutation = useMutation({
		mutationFn: async (
			updates: Partial<
				Pick<
					ChannelConfig,
					"tiktok_default_privacy_level" | "tiktok_disclosure"
				>
			>,
		) => {
			const c = queryClient.getQueryData(["channel", destinationId]) as
				| { config: ChannelConfig }
				| undefined
			if (!c) throw new Error("Channel not loaded")
			return updateChannelFn({
				data: { channelId: destinationId, config: { ...c.config, ...updates } },
			})
		},
		onSuccess: (r) => {
			if (r.ok) {
				void queryClient.invalidateQueries({
					queryKey: ["channel", destinationId],
				})
				return
			}
			toast.error(r.message ?? "Could not save")
		},
		onError: () => toast.error("Could not save"),
	})

	const updateConfirmedTermsMutation = useMutation({
		mutationFn: async (newTerms: PlatformConfirmedTerm[]) => {
			const c = queryClient.getQueryData(["channel", destinationId]) as
				| { config: ChannelConfig }
				| undefined
			if (!c) throw new Error("Channel not loaded")
			return updateChannelFn({
				data: {
					channelId: destinationId,
					config: { ...c.config, confirmed_terms: newTerms },
				},
			})
		},
		onSuccess: (r) => {
			if (r.ok) {
				void queryClient.invalidateQueries({
					queryKey: ["channel", destinationId],
				})
				return
			}
			toast.error(r.message ?? "Could not save")
		},
		onError: () => toast.error("Could not save"),
	})

	return {
		pauseScheduleMutation,
		resumeScheduleMutation,
		triggerNowMutation,
		updateTiktokDefaultsMutation,
		updateConfirmedTermsMutation,
	}
}
