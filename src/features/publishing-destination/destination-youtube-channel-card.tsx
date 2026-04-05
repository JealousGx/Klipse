import { Copy, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { youtubeChannelUrl } from "@/lib/youtube";
import { PublishingChannelThumbnail } from "./publishing-channel-thumbnail";
import type { PublishingDestinationChannel } from "./publishing-destination-channel.types";

type Props = {
	channel: PublishingDestinationChannel;
	onCopyChannelId: () => void;
	/** False when the user revoked Klipse in Google or the refresh token is no longer valid. */
	googleAccessActive: boolean;
};

/**
 * Shown when we have channel metadata (active OAuth or last-linked channel after revoke).
 */
export function DestinationYoutubeChannelFields({
	channel: ch,
	onCopyChannelId,
	googleAccessActive,
}: Props) {
	const thumbAlt = ch.externalChannelTitle
		? `${ch.externalChannelTitle} channel image`
		: "YouTube channel";

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

			{!googleAccessActive && ch.externalChannelId ? (
				<p className="rounded-lg border border-amber-500/35 bg-amber-500/8 px-3 py-2 text-sm text-foreground">
					Google access isn’t active for this destination—reconnect in{" "}
					<a
						href="#connection"
						className="font-medium text-primary underline underline-offset-2"
					>
						Google & YouTube
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
					<Button type="button" variant="outline" size="sm" asChild>
						<a
							href={youtubeChannelUrl(ch.externalChannelId)}
							target="_blank"
							rel="noopener noreferrer"
							className="gap-1.5"
						>
							<ExternalLink className="size-3.5" />
							Open on YouTube
						</a>
					</Button>
				</div>
			) : (
				<p className="text-sm text-muted-foreground">
					Connected with Google, but no channel id is stored yet. Try
					disconnecting and signing in again, or contact support if this
					persists.
				</p>
			)}
			<p className="text-xs text-muted-foreground">
				To change Google sign-in, use the{" "}
				<a
					href="#connection"
					className="font-medium text-foreground underline underline-offset-2"
				>
					Google & YouTube
				</a>{" "}
				section above.
			</p>
		</div>
	);
}
