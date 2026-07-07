import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate, useRouterState } from "@tanstack/react-router"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { useDashboardRouteContext } from "@/context/useDashboardRouteContext"
import {
	planAllowsPaidPublishingConnections,
	planAllowsScheduleFastForward,
} from "@/features/billing/tier-config"
import type {
	ChannelConfig,
	PlatformConfirmedTerm,
} from "@/features/channels/channel-config.schema"
import { reconcileYoutubeOAuthFn } from "@/features/channels/channels.functions"
import type { MeResponse } from "@/features/user/types/me"
import {
	channelQueryOptions,
	schedulingQueryOptions,
} from "@/lib/queries/dashboard-queries"

import {
	messageForPublishingConnectionErrorReason,
	type PublishingDestinationSearch,
} from "./publishing-destination-search.schema"
import type { PublishingDestinationViewProps } from "./publishing-destination-view"
import { usePublishingDestinationMutations } from "./use-publishing-destination-mutations"

export type PublishingDestinationPageState =
	| { status: "loading" }
	| { status: "error" }
	| { status: "ready"; viewProps: PublishingDestinationViewProps }

export function usePublishingDestinationPage(
	destinationId: string,
	search: PublishingDestinationSearch,
): PublishingDestinationPageState {
	const navigate = useNavigate()
	const queryClient = useQueryClient()
	const { session } = useDashboardRouteContext()
	const userPlan = (session.user.plan ?? "free") as MeResponse["plan"]
	const canConnectPublishing = planAllowsPaidPublishingConnections(userPlan)
	const canTriggerNow = planAllowsScheduleFastForward(userPlan)

	const channelQuery = useQuery(channelQueryOptions(destinationId))
	const scheduleQuery = useQuery(schedulingQueryOptions(destinationId))
	const locationHash = useRouterState({
		select: (s) => s.location.hash,
	})

	const [displayName, setDisplayName] = useState("")
	const [niche, setNiche] = useState("")
	const [autoPost, setAutoPost] = useState(false)
	const [frequency, setFrequency] =
		useState<ChannelConfig["posting_frequency"]>("weekly")

	useEffect(() => {
		let cancelled = false
		void reconcileYoutubeOAuthFn({ data: { channelId: destinationId } }).then(
			(r) => {
				if (cancelled || !r.ok || r.revokedChannelIds.length === 0) {
					return
				}
				toast.warning(
					"Google access for this destination was revoked or expired (for example, Klipse was removed in your Google Account). Reconnect with Google below.",
					{ id: `youtube-oauth-revoked-${destinationId}` },
				)
				void queryClient.invalidateQueries({ queryKey: ["channels"] })
				void queryClient.invalidateQueries({
					queryKey: ["channel", destinationId],
				})
			},
		)
		return () => {
			cancelled = true
		}
	}, [destinationId, queryClient])

	useEffect(() => {
		if (!search.oauth) {
			return
		}
		if (search.oauth === "connected") {
			toast.success("Publishing account connected successfully.")
		} else {
			toast.error(messageForPublishingConnectionErrorReason(search.reason))
		}
		void navigate({
			to: "/dashboard/publishing/$destinationId",
			params: { destinationId },
			search: {},
			hash: "connection",
			replace: true,
		})
	}, [search.oauth, search.reason, destinationId, navigate])

	useEffect(() => {
		const fragment = (locationHash ?? "").replace(/^#/, "")
		if (fragment !== "connection") {
			return
		}
		requestAnimationFrame(() => {
			const el =
				document.getElementById("connection") ??
				document.querySelector("[data-section='publishing-connection']")
			el?.scrollIntoView({ behavior: "smooth", block: "start" })
		})
	}, [locationHash])

	const {
		deleteMutation,
		updateProfileMutation,
		updateAutoPostMutation,
		updateFrequencyMutation,
		oauthDisconnectMutation,
		pauseScheduleMutation,
		resumeScheduleMutation,
		triggerNowMutation,
		updateTiktokDefaultsMutation,
		updateConfirmedTermsMutation,
		handleDisconnect,
		handleRemoveClick,
	} = usePublishingDestinationMutations(destinationId, {
		displayName,
		niche,
		setAutoPost,
		setFrequency,
	})

	const ch = channelQuery.data

	useEffect(() => {
		if (!ch) {
			return
		}
		setDisplayName(ch.name)
		setNiche(ch.niche)
		setAutoPost(ch.config.auto_post)
		setFrequency(ch.config.posting_frequency)
	}, [ch])

	const handleCopyChannelId = useCallback(() => {
		const id = ch?.externalChannelId
		if (!id) {
			return
		}
		void navigator.clipboard.writeText(id).then(
			() => toast.success("YouTube channel id copied"),
			() => toast.error("Could not copy"),
		)
	}, [ch?.externalChannelId])

	if (channelQuery.isPending) {
		return { status: "loading" }
	}

	if (channelQuery.isError || !ch) {
		return { status: "error" }
	}

	const viewProps: PublishingDestinationViewProps = {
		destinationId,
		channel: ch,
		displayName,
		niche,
		onDisplayNameChange: setDisplayName,
		onNicheChange: setNiche,
		onSaveProfile: () => {
			updateProfileMutation.mutate()
		},
		isSavingProfile: updateProfileMutation.isPending,
		autoPost,
		onAutoPostChange: (next) => {
			updateAutoPostMutation.mutate(next)
		},
		isSavingAutoPost: updateAutoPostMutation.isPending,
		onDisconnect: handleDisconnect,
		isDisconnectPending: oauthDisconnectMutation.isPending,
		canConnectPublishing,
		onCopyChannelId: handleCopyChannelId,
		onRemoveClick: handleRemoveClick,
		isRemovePending: deleteMutation.isPending,
		schedule: scheduleQuery.data ?? null,
		frequency,
		onFrequencyChange: (value) => updateFrequencyMutation.mutate(value),
		isChangingFrequency: updateFrequencyMutation.isPending,
		onPauseSchedule: () => pauseScheduleMutation.mutate(),
		onResumeSchedule: () => resumeScheduleMutation.mutate(),
		isPausingSchedule: pauseScheduleMutation.isPending,
		isResumingSchedule: resumeScheduleMutation.isPending,
		canTriggerNow,
		onTriggerNow: () => triggerNowMutation.mutate(),
		isTriggeringNow: triggerNowMutation.isPending,
		confirmedTerms: ch.config.confirmed_terms,
		onConfirmTerm: (term: PlatformConfirmedTerm, checked: boolean) => {
			const current = ch.config.confirmed_terms
			const newTerms = checked
				? ([...new Set([...current, term])] as PlatformConfirmedTerm[])
				: current.filter((t) => t !== term)
			updateConfirmedTermsMutation.mutate(newTerms)
		},
		isConfirmingTerm: updateConfirmedTermsMutation.isPending,
		tiktokDefaultPrivacyLevel: ch.config.tiktok_default_privacy_level,
		tiktokDisclosure: ch.config.tiktok_disclosure,
		onTiktokPrivacyLevelChange: (level: string) => {
			updateTiktokDefaultsMutation.mutate({
				tiktok_default_privacy_level: level,
			})
		},
		onTiktokDisclosureChange: (
			d: NonNullable<ChannelConfig["tiktok_disclosure"]>,
		) => {
			updateTiktokDefaultsMutation.mutate({ tiktok_disclosure: d })
		},
	}

	return { status: "ready", viewProps }
}
