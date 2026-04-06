import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { useDashboardRouteContext } from "@/context/useDashboardRouteContext";
import { planAllowsPaidPublishingConnections } from "@/features/billing/tier-config";
import type { ChannelConfig } from "@/features/channels/channel-config.schema";
import {
	deleteChannelFn,
	reconcileYoutubeOAuthFn,
	updateChannelFn,
} from "@/features/channels/channels.functions";
import type { MeResponse } from "@/features/user/types/me";
import { channelQueryOptions } from "@/lib/queries/dashboard-queries";

import {
	messageForYoutubeOAuthErrorReason,
	type PublishingDestinationSearch,
} from "./publishing-destination-search.schema";
import type { PublishingDestinationViewProps } from "./publishing-destination-view";

export type PublishingDestinationPageState =
	| { status: "loading" }
	| { status: "error" }
	| { status: "ready"; viewProps: PublishingDestinationViewProps };

export function usePublishingDestinationPage(
	destinationId: string,
	search: PublishingDestinationSearch,
): PublishingDestinationPageState {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { session } = useDashboardRouteContext();
	const userPlan = (session.user.plan ?? "free") as MeResponse["plan"];
	const canConnectPublishing = planAllowsPaidPublishingConnections(userPlan);

	const channelQuery = useQuery(channelQueryOptions(destinationId));
	const locationHash = useRouterState({
		select: (s) => s.location.hash,
	});

	const [displayName, setDisplayName] = useState("");
	const [niche, setNiche] = useState("");
	const [autoPost, setAutoPost] = useState(false);

	useEffect(() => {
		let cancelled = false;
		void reconcileYoutubeOAuthFn({ data: { channelId: destinationId } }).then(
			(r) => {
				if (cancelled || !r.ok || r.revokedChannelIds.length === 0) {
					return;
				}
				toast.warning(
					"Google access for this destination was revoked or expired (for example, Klipse was removed in your Google Account). Reconnect with Google below.",
					{ id: `youtube-oauth-revoked-${destinationId}` },
				);
				void queryClient.invalidateQueries({ queryKey: ["channels"] });
				void queryClient.invalidateQueries({
					queryKey: ["channel", destinationId],
				});
			},
		);
		return () => {
			cancelled = true;
		};
	}, [destinationId, queryClient]);

	useEffect(() => {
		if (!search.youtube) {
			return;
		}
		if (search.youtube === "connected") {
			toast.success("YouTube connected with Google.");
		} else {
			toast.error(messageForYoutubeOAuthErrorReason(search.reason));
		}
		void navigate({
			to: "/dashboard/publishing/$destinationId",
			params: { destinationId },
			search: {},
			hash: "connection",
			replace: true,
		});
	}, [search.youtube, search.reason, destinationId, navigate]);

	useEffect(() => {
		const fragment = (locationHash ?? "").replace(/^#/, "");
		if (fragment !== "connection") {
			return;
		}
		requestAnimationFrame(() => {
			const el =
				document.getElementById("connection") ??
				document.querySelector("[data-section='publishing-connection']");
			el?.scrollIntoView({ behavior: "smooth", block: "start" });
		});
	}, [locationHash]);

	const deleteMutation = useMutation({
		mutationFn: async () => {
			return deleteChannelFn({ data: { channelId: destinationId } });
		},
		onSuccess: (r) => {
			if (r.ok) {
				toast.success("Destination removed");
				void queryClient.invalidateQueries({ queryKey: ["channels"] });
				void navigate({ to: "/dashboard/publishing" });
				return;
			}
			toast.error("Couldn’t remove destination");
		},
	});

	const updateProfileMutation = useMutation({
		mutationFn: async () => {
			return updateChannelFn({
				data: {
					channelId: destinationId,
					name: displayName.trim(),
					niche: niche.trim(),
				},
			});
		},
		onSuccess: (r) => {
			if (r.ok) {
				toast.success("Destination updated");
				void queryClient.invalidateQueries({
					queryKey: ["channel", destinationId],
				});
				void queryClient.invalidateQueries({ queryKey: ["channels"] });
				return;
			}
			toast.error(r.message ?? "Could not save");
		},
	});

	const updateAutoPostMutation = useMutation({
		mutationFn: async (nextAutoPost: boolean) => {
			const c = queryClient.getQueryData(["channel", destinationId]) as
				| { config: ChannelConfig }
				| undefined;
			if (!c) {
				throw new Error("Channel not loaded");
			}
			return updateChannelFn({
				data: {
					channelId: destinationId,
					config: { ...c.config, auto_post: nextAutoPost },
				},
			});
		},
		onSuccess: (r) => {
			if (r.ok) {
				setAutoPost(r.channel.config.auto_post);
				toast.success("Publishing preference saved");
				void queryClient.invalidateQueries({
					queryKey: ["channel", destinationId],
				});
				void queryClient.invalidateQueries({ queryKey: ["channels"] });
				return;
			}
			toast.error(r.message ?? "Could not save");
		},
	});

	const updateLinkMutation = useMutation({
		mutationFn: async (payload: {
			platform: "unlinked" | "youtube";
			externalChannelId: string | null;
			externalChannelTitle: string | null;
			externalChannelHandle: string | null;
		}) => {
			return updateChannelFn({
				data: {
					channelId: destinationId,
					...payload,
				},
			});
		},
		onSuccess: (r, variables) => {
			if (r.ok) {
				if (variables.externalChannelId === null) {
					toast.success("YouTube disconnected");
				}
				void queryClient.invalidateQueries({
					queryKey: ["channel", destinationId],
				});
				void queryClient.invalidateQueries({ queryKey: ["channels"] });
				return;
			}
			toast.error(r.message ?? "Could not save");
		},
	});

	const ch = channelQuery.data;

	useEffect(() => {
		if (!ch) {
			return;
		}
		setDisplayName(ch.name);
		setNiche(ch.niche);
		setAutoPost(ch.config.auto_post);
	}, [ch]);

	const handleDisconnect = useCallback(() => {
		if (
			typeof window !== "undefined" &&
			!window.confirm(
				"Disconnect YouTube from this destination? Google access is removed. You can reconnect later, but only with the same YouTube channel (first channel linked to this destination).",
			)
		) {
			return;
		}
		updateLinkMutation.mutate({
			platform: "unlinked",
			externalChannelId: null,
			externalChannelTitle: null,
			externalChannelHandle: null,
		});
	}, [updateLinkMutation]);

	const handleCopyChannelId = useCallback(() => {
		const id = ch?.externalChannelId;
		if (!id) {
			return;
		}
		void navigator.clipboard.writeText(id).then(
			() => toast.success("YouTube channel id copied"),
			() => toast.error("Could not copy"),
		);
	}, [ch?.externalChannelId]);

	const handleRemoveClick = useCallback(() => {
		if (
			typeof window !== "undefined" &&
			!window.confirm(
				"Remove this publishing destination? Associated jobs in the database may be deleted.",
			)
		) {
			return;
		}
		deleteMutation.mutate();
	}, [deleteMutation]);

	if (channelQuery.isPending) {
		return { status: "loading" };
	}

	if (channelQuery.isError || !ch) {
		return { status: "error" };
	}

	const viewProps: PublishingDestinationViewProps = {
		destinationId,
		channel: ch,
		displayName,
		niche,
		onDisplayNameChange: setDisplayName,
		onNicheChange: setNiche,
		onSaveProfile: () => {
			updateProfileMutation.mutate();
		},
		isSavingProfile: updateProfileMutation.isPending,
		autoPost,
		onAutoPostChange: (next) => {
			updateAutoPostMutation.mutate(next);
		},
		isSavingAutoPost: updateAutoPostMutation.isPending,
		onDisconnect: handleDisconnect,
		isDisconnectPending: updateLinkMutation.isPending,
		canConnectPublishing,
		onCopyChannelId: handleCopyChannelId,
		onRemoveClick: handleRemoveClick,
		isRemovePending: deleteMutation.isPending,
	};

	return { status: "ready", viewProps };
}
