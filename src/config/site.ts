import { env } from "@/env";

/** Hostnames where search indexing is allowed (production marketing domain). */
export const DOMAINS_ALLOWED_TO_INDEX = ["klipse.app"] as const;

export function getSiteUrl() {
	const url = env.VITE_APP_URL ?? "http://localhost:3000";
	return url.replace(/\/$/, "");
}

export const siteConfig = {
	name: env.VITE_APP_TITLE ?? "Klipse",
	discord: env.VITE_APP_DISCORD_URL,
	description:
		"Queue-driven AI video pipelines for operators—script to generate to schedule to publish. Platform-native workflows, full visibility, retries, and hybrid pricing.",
	tagline: "Content infrastructure for operators",
	origin: getSiteUrl(),
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
		"faceless video generator",
		"YouTube Shorts automation",
		"multi-platform video publishing",
		"automated content channels",
		"AI-generated video with disclosure",
		"AI video automation SaaS",
		"AI content pipeline",
	],
	og: {
		image: "/og.png",
	},
	twitter: {
		card: "summary_large_image",
		creator: "@khiljimateenn",
	},
} as const;

export const isAllowedToIndex = (hostname: string) => {
	return (DOMAINS_ALLOWED_TO_INDEX as readonly string[]).includes(hostname);
};
