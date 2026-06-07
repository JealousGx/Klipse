import { Link } from "@tanstack/react-router"
import { CheckCircle2, Loader2, Unplug } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
	platformAuthProviderName,
	platformDisplayName,
	platformOAuthStartUrl,
} from "@/lib/platform-publishing"

import type { PublishingDestinationChannel } from "./publishing-destination-channel.types"

type Props = {
	destinationId: string
	channel: PublishingDestinationChannel
	/** False on Free — paid publishing OAuth is blocked server-side. */
	canConnectPublishing: boolean
	onDisconnect: () => void
	isDisconnectPending: boolean
}

/** Implemented platforms a user can connect (ordered by launch priority). */
const CONNECTABLE_PLATFORMS = ["youtube", "tiktok"] as const

/** Inner body for the platform connection block (wrapped by `DashboardPanel` in the view). */
export function DestinationConnectionFields({
	destinationId,
	channel: ch,
	canConnectPublishing,
	onDisconnect,
	isDisconnectPending,
}: Props) {
	const isUnlinked = ch.platform === "unlinked"

	// For a connected or platform-specific channel, use its assigned platform.
	// For unlinked channels the platform picker below handles selection.
	const connectPlatform = isUnlinked ? null : ch.platform
	const platformName = connectPlatform
		? platformDisplayName(connectPlatform)
		: null
	const authProvider = connectPlatform
		? platformAuthProviderName(connectPlatform)
		: null
	const oauthHref = connectPlatform
		? platformOAuthStartUrl(connectPlatform, destinationId)
		: null

	// Only show Disconnect when an active OAuth token is stored.
	const showDisconnect = ch.oauthConnected
	const needsOAuth = !ch.oauthConnected
	const boundId = ch.boundExternalAccountId
	const mustReconnectSameChannel = Boolean(boundId && !ch.oauthConnected)
	// Prefer a human-readable label over the raw external account id.
	const boundLabel =
		ch.externalChannelTitle?.trim() ||
		ch.externalChannelHandle?.trim() ||
		boundId

	return (
		<div className="flex flex-col gap-5" data-section="publishing-connection">
			{ch.oauthConnected && authProvider && platformName ? (
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

			{mustReconnectSameChannel && authProvider && platformName ? (
				<p className="text-xs leading-relaxed text-muted-foreground">
					<strong className="font-medium text-foreground">
						Same {platformName} channel only.
					</strong>{" "}
					This destination is linked to{" "}
					<strong className="font-medium text-foreground">{boundLabel}</strong>.
					Use{" "}
					<strong className="font-medium text-foreground">
						Connect with {authProvider}
					</strong>{" "}
					and sign in with the {authProvider} account that owns that channel —
					another channel cannot be attached here.
				</p>
			) : null}

			<div className="flex flex-wrap items-center gap-2">
				{needsOAuth ? (
					isUnlinked ? (
						// Platform picker — shown for new unlinked destinations.
						canConnectPublishing ? (
							CONNECTABLE_PLATFORMS.map((p) => {
									const href = platformOAuthStartUrl(p, destinationId)
									const provider = platformAuthProviderName(p)
									return href ? (
										<Button
											key={p}
											type="button"
											className="w-fit gap-2 shadow-sm"
											asChild
										>
											<a href={href}>Connect with {provider}</a>
										</Button>
									) : null
								})
						) : (
							<Button type="button" className="w-fit gap-2 shadow-sm" asChild>
								<Link to="/dashboard/billing">Upgrade to connect</Link>
							</Button>
						)
					) : canConnectPublishing && oauthHref ? (
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
	)
}
