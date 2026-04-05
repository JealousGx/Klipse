import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { DashboardPanel } from "@/components/dashboard/dashboard-panel";
import { DashboardSection } from "@/components/dashboard/dashboard-section";
import { Button } from "@/components/ui/button";

import { DestinationConnectionFields } from "./destination-connection-section";
import { DestinationDetailsFields } from "./destination-details-card";
import { DestinationYoutubeChannelFields } from "./destination-youtube-channel-card";
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
	onDisconnect: () => void;
	isDisconnectPending: boolean;
	onCopyChannelId: () => void;
	onRemoveClick: () => void;
	isRemovePending: boolean;
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
	onDisconnect,
	isDisconnectPending,
	onCopyChannelId,
	onRemoveClick,
	isRemovePending,
}: PublishingDestinationViewProps) {
	const youtubeConnected = channel.youtubeConnected;

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
						Link your Google account, set how this destination appears in
						Klipse, and review your YouTube channel after you connect. The
						distinction between your{" "}
						<strong className="font-medium text-foreground">
							Klipse label
						</strong>{" "}
						and your{" "}
						<strong className="font-medium text-foreground">
							YouTube channel title
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
						title="Google & YouTube"
						description="Connect your Google account so we can read channel metadata and publish."
						isFirst
						tabIndex={-1}
						className="scroll-mt-24 outline-none md:scroll-mt-20 lg:scroll-mt-24"
					>
						<DashboardPanel variant="emphasis">
							<DestinationConnectionFields
								destinationId={destinationId}
								channel={channel}
								onDisconnect={onDisconnect}
								isDisconnectPending={isDisconnectPending}
							/>
						</DashboardPanel>
					</DashboardSection>

					{youtubeConnected ? (
						<DashboardSection
							id="youtube-channel"
							titleId="youtube-channel-heading"
							title="YouTube channel"
							description="Channel id and title from your connected Google account."
						>
							<DashboardPanel>
								<DestinationYoutubeChannelFields
									channel={channel}
									onCopyChannelId={onCopyChannelId}
								/>
							</DashboardPanel>
						</DashboardSection>
					) : null}

					<DashboardSection
						id="destination-details"
						titleId="destination-details-heading"
						title="Destination details"
						description={
							youtubeConnected
								? "Internal to Klipse: not synced from YouTube. Your public channel title from Google is shown in the YouTube channel section."
								: "Internal to Klipse: not synced from YouTube. After you connect Google, your channel title appears in the YouTube channel section."
						}
					>
						<DashboardPanel>
							<DestinationDetailsFields
								youtubeConnected={youtubeConnected}
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
						youtubeConnected={youtubeConnected}
						onRemoveClick={onRemoveClick}
						isRemovePending={isRemovePending}
					/>
				</aside>
			</div>
		</div>
	);
}
