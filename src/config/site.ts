import { env } from "@/env";

/** Hostnames where search indexing is allowed (production marketing domain). */
export const DOMAINS_ALLOWED_TO_INDEX = ["klipse.app"] as const;

export function getSiteUrl() {
	return env.VITE_APP_URL ?? "http://localhost:3000";
}

export const siteConfig = {
	name: env.VITE_APP_TITLE ?? "Klipse",
	description:
		"Original AI generation and verified owner-only workflows—script to video with platform-native AI disclosure, human-like scheduling, and multi-platform publishing.",
	tagline: "Original AI content built for authenticity and transparency",
	domain: getSiteUrl(),
	get url() {
		return getSiteUrl();
	},
	supportEmail: env.VITE_APP_SUPPORT_EMAIL,
	locale: "en_US",
	creator: "JealousGx",
	keywords: [
		"AI video",
		"original content",
		"YouTube Shorts",
		"Reels",
		"TikTok",
		"AI disclosure",
		"content creator",
		"vertical video",
		"Gemini",
		"verified owner",
		"multi-platform publishing",
	],
	og: {
		image: "/og.png",
	},
} as const;

export const isAllowedToIndex = (): boolean => {
	const hostname = new URL(getSiteUrl()).hostname;
	return (DOMAINS_ALLOWED_TO_INDEX as readonly string[]).includes(hostname);
};
