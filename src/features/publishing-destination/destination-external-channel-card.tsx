import { Copy, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
	platformAuthProviderName,
	platformChannelUrl,
	platformDisplayName,
} from "@/lib/platform-publishing";
import { PublishingChannelThumbnail } from "./publishing-channel-thumbnail";
import type { PublishingDestinationChannel } from "./publishing-destination-channel.types";

type Props = {
	channel: PublishingDestinationChannel;
	onCopyChannelId: () => void;
	/** False when the platform OAuth token is no longer valid (e.g. user revoked access). */
	oauthAccessActive: boolean;
};

/**
 * Shown when we have channel metadata (active OAuth or last-linked channel after revoke).
 * Platform-agnostic: renders labels and links based on `channel.platform`.
 */
export function DestinationExternalChannelFields({
	channel: ch,
	onCopyChannelId,
	oauthAccessActive,
}: Props) {
	const platformName = platformDisplayName(ch.platform);
	const authProvider = platformAuthProviderName(ch.platform);
	const thumbAlt = ch.externalChannelTitle
		? `${ch.externalChannelTitle} channel image`
		: `${platformName} channel`;

	const channelUrl = ch.externalChannelId
		? platformChannelUrl(ch.platform, ch.externalChannelId)
		: null;

	return (
		<div className="space-y-4">
			{ch.externalChannelId ? (
				<div className="flex flex-wrap items-center gap-4">
					<PublishingChannelThumbnail
						src={ch.externalChannelThumbnailUrl}
						alt={thumbAlt}
						size="md"
						className="ring-1 ring-border/60"
					/>
					{ch.externalChannelTitle ? (
						<div className="min-w-0 flex-1">
							<p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
								Channel title
							</p>
							<p className="mt-0.5 text-sm font-medium text-foreground">
								{ch.externalChannelTitle}
							</p>
						</div>
					) : null}
				</div>
			) : null}

			{!oauthAccessActive && ch.externalChannelId ? (
				<p className="rounded-lg border border-amber-500/35 bg-amber-500/8 px-3 py-2 text-sm text-foreground">
					{authProvider} access isn't active for this destination—reconnect in{" "}
					<a
						href="#connection"
						className="font-medium text-primary underline underline-offset-2"
					>
						{authProvider} &amp; {platformName}
					</a>{" "}
					so Klipse can publish again.
				</p>
			) : null}

			{ch.externalChannelId ? (
				<div className="flex flex-wrap items-center gap-2">
					<code className="rounded-md bg-muted/60 px-2 py-1 font-mono text-xs break-all text-foreground">
						{ch.externalChannelId}
					</code>
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="gap-1.5"
						onClick={onCopyChannelId}
					>
						<Copy className="size-3.5" />
						Copy
					</Button>
					{channelUrl ? (
						<Button type="button" variant="outline" size="sm" asChild>
							<a
								href={channelUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="gap-1.5"
							>
								<ExternalLink className="size-3.5" />
								Open on {platformName}
							</a>
						</Button>
					) : null}
				</div>
			) : (
				<p className="text-sm text-muted-foreground">
					Connected with {authProvider}, but no channel id is stored yet. Try
					disconnecting and signing in again, or contact support if this
					persists.
				</p>
			)}

			<p className="text-xs text-muted-foreground">
				To change your {authProvider} sign-in, use the{" "}
				<a
					href="#connection"
					className="font-medium text-foreground underline underline-offset-2"
				>
					{authProvider} &amp; {platformName}
				</a>{" "}
				section above.
			</p>
		</div>
	);
}
