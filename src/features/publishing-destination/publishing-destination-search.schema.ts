import { z } from "zod";

export const publishingDestinationSearchSchema = z.object({
	youtube: z.enum(["connected", "error"]).optional(),
	reason: z.string().optional(),
});

export type PublishingDestinationSearch = z.infer<
	typeof publishingDestinationSearchSchema
>;

/** User-facing copy for OAuth redirects that include `reason` in the URL. */
export function messageForYoutubeOAuthErrorReason(
	reasonRaw: string | undefined,
): string {
	const r = reasonRaw ? decodeURIComponent(reasonRaw) : undefined;
	if (r === "wrong_youtube_channel") {
		return "This publishing destination is already tied to another YouTube channel. Sign in with the Google account that owns the channel you first connected.";
	}
	if (r === "youtube_channel_in_use") {
		return "This YouTube channel is already linked to another publishing destination. Disconnect it there first, or connect a different channel here.";
	}
	if (r === "youtube_scopes_incomplete") {
		return "Google didn’t grant all permissions Klipse needs (view your channel and upload videos). Try again and leave every YouTube permission checked.";
	}
	if (r === "access_denied") {
		return "You canceled Google sign-in or denied access. Connect again and approve access to continue.";
	}
	return r ? `YouTube connection failed: ${r}` : "YouTube connection failed.";
}
