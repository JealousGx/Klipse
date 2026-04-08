import { Link } from "@tanstack/react-router";
import { CheckCircle2, Loader2, Unplug } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
	platformAuthProviderName,
	platformDisplayName,
	platformOAuthStartUrl,
} from "@/lib/platform-publishing";

import type { PublishingDestinationChannel } from "./publishing-destination-channel.types";

type Props = {
	destinationId: string;
	channel: PublishingDestinationChannel;
	/** False on Free — paid publishing OAuth is blocked server-side. */
	canConnectPublishing: boolean;
	onDisconnect: () => void;
	isDisconnectPending: boolean;
};

/** Inner body for the platform connection block (wrapped by `DashboardPanel` in the view). */
export function DestinationConnectionFields({
	destinationId,
	channel: ch,
	canConnectPublishing,
	onDisconnect,
	isDisconnectPending,
}: Props) {
	// An unlinked channel has no platform yet — default to YouTube since it's the
	// only implemented OAuth flow. Replace with a platform picker when TikTok /
	// Instagram OAuth lands.
	const connectPlatform = ch.platform === "unlinked" ? "youtube" : ch.platform;
	const platformName = platformDisplayName(connectPlatform);
	const authProvider = platformAuthProviderName(connectPlatform);
	const oauthHref = platformOAuthStartUrl(connectPlatform, destinationId);

	const showDisconnect = Boolean(ch.externalChannelId || ch.oauthConnected);
	const needsOAuth = !ch.oauthConnected;
	const boundId = ch.boundExternalAccountId;
	const mustReconnectSameChannel = Boolean(boundId && !ch.oauthConnected);

	return (
		<div className="flex flex-col gap-5" data-section="publishing-connection">
			{ch.oauthConnected ? (
				<div className="flex gap-3">
					<div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
						<CheckCircle2 className="size-5" aria-hidden />
					</div>
					<div className="min-w-0 space-y-1">
						<p className="text-sm font-medium text-foreground">
							Connected with {authProvider}
						</p>
						<p className="text-sm text-muted-foreground">
							This publishing destination stays tied to that {platformName}{" "}
							channel. You can disconnect to revoke access, then reconnect with
							the same {authProvider} account when you're ready.
						</p>
					</div>
				</div>
			) : null}

			{mustReconnectSameChannel ? (
				<p className="text-xs leading-relaxed text-muted-foreground">
					<strong className="font-medium text-foreground">
						Same {platformName} channel only.
					</strong>{" "}
					This destination is already linked to channel{" "}
					<code className="rounded bg-muted/70 px-1 py-0.5 font-mono text-[11px] text-foreground">
						{boundId}
					</code>
					. Use{" "}
					<strong className="font-medium text-foreground">
						Connect with {authProvider}
					</strong>{" "}
					and sign in with the {authProvider} account that{" "}
					<strong className="font-medium text-foreground">
						owns that channel
					</strong>
					—another channel cannot be attached here.
				</p>
			) : null}

			<div className="flex flex-wrap items-center gap-2">
				{needsOAuth ? (
					canConnectPublishing && oauthHref ? (
						<Button type="button" className="w-fit gap-2 shadow-sm" asChild>
							<a href={oauthHref}>Connect with {authProvider}</a>
						</Button>
					) : canConnectPublishing && !oauthHref ? (
						<Button
							type="button"
							className="w-fit gap-2 shadow-sm"
							disabled
							title={`${platformName} publishing is coming soon.`}
						>
							{platformName} — coming soon
						</Button>
					) : (
						<Button type="button" className="w-fit gap-2 shadow-sm" asChild>
							<Link to="/dashboard/billing">
								Upgrade to connect {platformName}
							</Link>
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
						Connected with {authProvider}
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
						Disconnect {platformName}
					</Button>
				) : null}
			</div>
		</div>
	);
}
