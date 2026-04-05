import "@tanstack/react-start/server-only";

import { env } from "@/env";

/** Readonly to resolve channel; upload for future publish jobs. */
const YOUTUBE_SCOPES = [
	"https://www.googleapis.com/auth/youtube.readonly",
	"https://www.googleapis.com/auth/youtube.upload",
].join(" ");

export function buildGoogleYoutubeAuthorizeUrl(input: {
	redirectUri: string;
	state: string;
}): string {
	const p = new URLSearchParams({
		client_id: env.GOOGLE_CLIENT_ID,
		redirect_uri: input.redirectUri,
		response_type: "code",
		scope: YOUTUBE_SCOPES,
		access_type: "offline",
		prompt: "consent",
		state: input.state,
	});
	return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`;
}

export async function exchangeYoutubeAuthorizationCode(input: {
	code: string;
	redirectUri: string;
}): Promise<{
	access_token: string;
	refresh_token?: string;
	expires_in?: number;
}> {
	const body = new URLSearchParams({
		code: input.code,
		client_id: env.GOOGLE_CLIENT_ID,
		client_secret: env.GOOGLE_CLIENT_SECRET,
		redirect_uri: input.redirectUri,
		grant_type: "authorization_code",
	});
	const res = await fetch("https://oauth2.googleapis.com/token", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body,
	});
	if (!res.ok) {
		const t = await res.text();
		throw new Error(`token_exchange_failed: ${res.status} ${t}`);
	}
	return res.json() as Promise<{
		access_token: string;
		refresh_token?: string;
		expires_in?: number;
	}>;
}

export async function fetchYoutubeMineChannel(accessToken: string): Promise<{
	id: string;
	title: string;
	customUrl: string | null;
}> {
	const url = new URL("https://www.googleapis.com/youtube/v3/channels");
	url.searchParams.set("part", "snippet");
	url.searchParams.set("mine", "true");
	const res = await fetch(url.toString(), {
		headers: { Authorization: `Bearer ${accessToken}` },
	});
	if (!res.ok) {
		const t = await res.text();
		throw new Error(`youtube_channels_failed: ${res.status} ${t}`);
	}
	const data = (await res.json()) as {
		items?: Array<{ id: string; snippet?: { title?: string; customUrl?: string } }>;
	};
	const item = data.items?.[0];
	if (!item?.id) {
		throw new Error("youtube_no_channel");
	}
	return {
		id: item.id,
		title: item.snippet?.title ?? "",
		customUrl: item.snippet?.customUrl ?? null,
	};
}
