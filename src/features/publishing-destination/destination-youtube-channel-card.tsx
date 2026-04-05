import { Copy, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { youtubeChannelUrl } from "@/lib/youtube";

import type { PublishingDestinationChannel } from "./publishing-destination-channel.types";

type Props = {
	channel: PublishingDestinationChannel;
	onCopyChannelId: () => void;
};

/**
 * Shown only when `youtubeConnected` (OAuth). Channel id comes from Google sign-in, not manual entry.
 */
export function DestinationYoutubeChannelFields({
	channel: ch,
	onCopyChannelId,
}: Props) {
	return (
		<div className="space-y-4">
			{ch.externalChannelId ? (
				<>
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
					{ch.externalChannelTitle ? (
						<div>
							<p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
								Channel title
							</p>
							<p className="mt-0.5 text-sm text-foreground">
								{ch.externalChannelTitle}
							</p>
						</div>
					) : null}
				</>
			) : (
				<p className="text-sm text-muted-foreground">
					Connected with Google, but no channel id is stored yet. Try disconnecting
					and signing in again, or contact support if this persists.
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
