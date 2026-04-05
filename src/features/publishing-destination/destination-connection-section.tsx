import { CheckCircle2, Loader2, Unplug } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";

import type { PublishingDestinationChannel } from "./publishing-destination-channel.types";

type Props = {
	destinationId: string;
	channel: PublishingDestinationChannel;
	/** False on Free — paid publishing OAuth is blocked server-side. */
	canConnectPublishing: boolean;
	onDisconnect: () => void;
	isDisconnectPending: boolean;
};

/** Inner body for the Google / YouTube block (wrapped by `DashboardPanel` in the view). */
export function DestinationConnectionFields({
	destinationId,
	channel: ch,
	canConnectPublishing,
	onDisconnect,
	isDisconnectPending,
}: Props) {
	const oauthHref = `/api/youtube/oauth/start?channelId=${encodeURIComponent(destinationId)}`;
	const showDisconnect = Boolean(ch.externalChannelId || ch.youtubeConnected);
	const needsGoogleOAuth = !ch.youtubeConnected;
	const boundId = ch.boundYoutubeChannelId;
	const mustReconnectSameChannel = Boolean(boundId && !ch.youtubeConnected);

	return (
		<div className="flex flex-col gap-5" data-section="publishing-connection">
			{ch.youtubeConnected ? (
				<div className="flex gap-3">
					<div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
						<CheckCircle2 className="size-5" aria-hidden />
					</div>
					<div className="min-w-0 space-y-1">
						<p className="text-sm font-medium text-foreground">
							Connected with Google
						</p>
						<p className="text-sm text-muted-foreground">
							This publishing destination stays tied to that YouTube channel.
							You can disconnect to revoke access, then reconnect with the same
							Google account when you’re ready.
						</p>
					</div>
				</div>
			) : null}

			{mustReconnectSameChannel ? (
				<p className="text-xs leading-relaxed text-muted-foreground">
					<strong className="font-medium text-foreground">
						Same YouTube channel only.
					</strong>{" "}
					This destination is already linked to channel{" "}
					<code className="rounded bg-muted/70 px-1 py-0.5 font-mono text-[11px] text-foreground">
						{boundId}
					</code>
					. Use{" "}
					<strong className="font-medium text-foreground">
						Connect with Google
					</strong>{" "}
					and sign in with the Google account that{" "}
					<strong className="font-medium text-foreground">
						owns that channel
					</strong>
					—another channel cannot be attached here.
				</p>
			) : null}

			<div className="flex flex-wrap items-center gap-2">
				{needsGoogleOAuth ? (
					canConnectPublishing ? (
						<Button type="button" className="w-fit gap-2 shadow-sm" asChild>
							<a href={oauthHref}>Connect with Google</a>
						</Button>
					) : (
						<Button type="button" className="w-fit gap-2 shadow-sm" asChild>
							<Link to="/dashboard/billing">Upgrade to connect YouTube</Link>
						</Button>
					)
				) : (
					<Button
						type="button"
						variant="secondary"
						disabled
						className="w-fit gap-2 opacity-90"
						title="Already connected. Disconnect below if you need to revoke access."
					>
						<CheckCircle2 className="size-4 opacity-80" aria-hidden />
						Connected with Google
					</Button>
				)}

				{showDisconnect ? (
					<Button
						type="button"
						variant="destructive"
						disabled={isDisconnectPending}
						className="w-fit gap-2 shadow-sm"
						onClick={onDisconnect}
					>
						{isDisconnectPending ? (
							<Loader2 className="size-4 animate-spin" aria-hidden />
						) : (
							<Unplug className="size-4" aria-hidden />
						)}
						Disconnect YouTube
					</Button>
				) : null}
			</div>
		</div>
	);
}
