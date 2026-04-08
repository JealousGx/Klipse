import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { DashboardPanel } from "@/components/dashboard/dashboard-panel";
import { DashboardSection } from "@/components/dashboard/dashboard-section";
import { Button } from "@/components/ui/button";
import type { ChannelConfig } from "@/features/channels/channel-config.schema";
import { DestinationAutoPostFields } from "./destination-auto-post-fields";
import { DestinationConnectionFields } from "./destination-connection-section";
import { DestinationDetailsFields } from "./destination-details-card";
import { DestinationExternalChannelFields } from "./destination-external-channel-card";
import { DestinationScheduleFields } from "./destination-schedule-fields";
import type { PublishingDestinationChannel } from "./publishing-destination-channel.types";
import { PublishingDestinationWidgets } from "./publishing-destination-widgets";

export type PublishingDestinationViewProps = {
	destinationId: string;
	channel: PublishingDestinationChannel;
	displayName: string;
	niche: string;
	onDisplayNameChange: (value: string) => void;
	onNicheChange: (value: string) => void;
	onSaveProfile: () => void;
	isSavingProfile: boolean;
	autoPost: boolean;
	onAutoPostChange: (next: boolean) => void;
	isSavingAutoPost: boolean;
	onDisconnect: () => void;
	isDisconnectPending: boolean;
	/** Paid plan allows OAuth for publishing integrations (YouTube today; others later). */
	canConnectPublishing: boolean;
	onCopyChannelId: () => void;
	onRemoveClick: () => void;
	isRemovePending: boolean;
	schedule: {
		nextRunAt: Date;
		frequency: ChannelConfig["posting_frequency"];
		enabled: boolean;
	} | null;
	frequency: ChannelConfig["posting_frequency"];
	onFrequencyChange: (value: ChannelConfig["posting_frequency"]) => void;
	isChangingFrequency: boolean;
	onPauseSchedule: () => void;
	onResumeSchedule: () => void;
	isPausingSchedule: boolean;
	isResumingSchedule: boolean;
	canTriggerNow: boolean;
	onTriggerNow: () => void;
	isTriggeringNow: boolean;
};

export function PublishingDestinationView({
	destinationId,
	channel,
	displayName,
	niche,
	onDisplayNameChange,
	onNicheChange,
	onSaveProfile,
	isSavingProfile,
	autoPost,
	onAutoPostChange,
	isSavingAutoPost,
	onDisconnect,
	isDisconnectPending,
	canConnectPublishing,
	onCopyChannelId,
	onRemoveClick,
	isRemovePending,
	schedule,
	frequency,
	onFrequencyChange,
	isChangingFrequency,
	onPauseSchedule,
	onResumeSchedule,
	isPausingSchedule,
	isResumingSchedule,
	canTriggerNow,
	onTriggerNow,
	isTriggeringNow,
}: PublishingDestinationViewProps) {
	const oauthConnected = channel.oauthConnected;
	const showConnectedChannelSection = Boolean(
		oauthConnected || channel.externalChannelId,
	);

	return (
		<div className="w-full space-y-8 pb-4 lg:space-y-10">
			<div className="space-y-4">
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="-ml-2 gap-2 text-muted-foreground hover:text-foreground"
					asChild
				>
					<Link to="/dashboard/publishing">
						<ArrowLeft className="size-4" />
						All destinations
					</Link>
				</Button>
				<div className="space-y-2 border-l-2 border-primary/30 pl-5">
					<h2 className="font-heading text-xl font-semibold tracking-tight text-foreground md:text-2xl">
						{channel.name}
					</h2>
					<p className="m-0 max-w-3xl text-sm leading-relaxed text-muted-foreground">
						Link your publishing account, set how this destination appears in
						Klipse, and review connected channel details after you connect. The
						distinction between your{" "}
						<strong className="font-medium text-foreground">
							Klipse label
						</strong>{" "}
						and your{" "}
						<strong className="font-medium text-foreground">
							platform channel title
						</strong>{" "}
						is explained next to each field below.
					</p>
				</div>
			</div>

			<div className="lg:grid lg:grid-cols-[minmax(0,1fr)_min(17.5rem,32%)] lg:items-start lg:gap-8 xl:grid-cols-[minmax(0,1fr)_20rem] xl:gap-10">
				<div className="min-w-0 space-y-10">
					<DashboardSection
						id="connection"
						titleId="connection-heading"
						title="Publishing account"
						description="Connect your publishing account so we can read channel metadata and publish."
						isFirst
						tabIndex={-1}
						className="scroll-mt-24 outline-none md:scroll-mt-20 lg:scroll-mt-24"
					>
						<DashboardPanel variant="emphasis">
							<DestinationConnectionFields
								destinationId={destinationId}
								channel={channel}
								canConnectPublishing={canConnectPublishing}
								onDisconnect={onDisconnect}
								isDisconnectPending={isDisconnectPending}
							/>
						</DashboardPanel>
					</DashboardSection>

					{showConnectedChannelSection ? (
						<DashboardSection
							id="connected-channel"
							titleId="connected-channel-heading"
							title="Connected channel"
							description={
								oauthConnected
									? "Channel id and title from your connected account."
									: "Last linked channel. Reconnect above to restore access."
							}
						>
							<DashboardPanel>
								<DestinationExternalChannelFields
									channel={channel}
									onCopyChannelId={onCopyChannelId}
									oauthAccessActive={oauthConnected}
								/>
							</DashboardPanel>
						</DashboardSection>
					) : null}

					<DashboardSection
						id="auto-post"
						titleId="auto-post-heading"
						title="After a video is ready"
						description="Control whether we ask you before publishing to your linked channel (paid plans)."
					>
						<DashboardPanel>
							<DestinationAutoPostFields
								autoPost={autoPost}
								onAutoPostChange={onAutoPostChange}
								disabled={!canConnectPublishing}
								disabledReason={
									!canConnectPublishing
										? "Upgrade to a paid plan with linked publishing to choose auto-publish or ask-first for this destination."
										: undefined
								}
								isSaving={isSavingAutoPost}
							/>
						</DashboardPanel>
					</DashboardSection>

					<DashboardSection
						id="posting-schedule"
						titleId="posting-schedule-heading"
						title="Posting schedule"
						description="Klipse generates a video automatically for this channel based on the schedule below. Pause at any time — your channel niche is used as the topic."
					>
						<DashboardPanel>
							<DestinationScheduleFields
								schedule={schedule}
								frequency={frequency}
								onFrequencyChange={onFrequencyChange}
								isChangingFrequency={isChangingFrequency}
								onPause={onPauseSchedule}
								onResume={onResumeSchedule}
								isPausing={isPausingSchedule}
								isResuming={isResumingSchedule}
								canTriggerNow={canTriggerNow}
								onTriggerNow={onTriggerNow}
								isTriggeringNow={isTriggeringNow}
							/>
						</DashboardPanel>
					</DashboardSection>

					<DashboardSection
						id="destination-details"
						titleId="destination-details-heading"
						title="Destination details"
						description={
							oauthConnected
								? "Internal to Klipse: not synced from your platform. Your public channel title is shown in the connected channel section."
								: "Internal to Klipse: not synced from your platform. After you connect your account, your channel title appears in the connected channel section."
						}
					>
						<DashboardPanel>
							<DestinationDetailsFields
								oauthConnected={oauthConnected}
								displayName={displayName}
								niche={niche}
								onDisplayNameChange={onDisplayNameChange}
								onNicheChange={onNicheChange}
								onSave={onSaveProfile}
								isSaving={isSavingProfile}
							/>
						</DashboardPanel>
					</DashboardSection>
				</div>

				<aside
					className="mt-10 lg:sticky lg:top-6 lg:mt-0 lg:max-h-[min(100dvh-5rem,56rem)] lg:overflow-y-auto lg:pr-1"
					aria-label="Destination summary and actions"
				>
					<PublishingDestinationWidgets
						destinationId={destinationId}
						oauthConnected={oauthConnected}
						onRemoveClick={onRemoveClick}
						isRemovePending={isRemovePending}
					/>
				</aside>
			</div>
		</div>
	);
}
