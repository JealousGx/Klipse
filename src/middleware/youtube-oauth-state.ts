import { createHmac, timingSafeEqual } from "node:crypto"

export type YoutubeOAuthStatePayload = {
	u: string
	c: string
	exp: number
}

export function signYoutubeOAuthState(
	payload: YoutubeOAuthStatePayload,
	secret: string,
): string {
	const data = Buffer.from(JSON.stringify(payload), "utf8").toString(
		"base64url",
	)
	const sig = createHmac("sha256", secret).update(data).digest("base64url")
	return `${data}.${sig}`
}

export function verifyYoutubeOAuthState(
	token: string,
	secret: string,
): YoutubeOAuthStatePayload | null {
	const lastDot = token.lastIndexOf(".")
	if (lastDot <= 0) {
		return null
	}
	const data = token.slice(0, lastDot)
	const sig = token.slice(lastDot + 1)
	const expected = createHmac("sha256", secret).update(data).digest("base64url")
	if (
		sig.length !== expected.length ||
		!timingSafeEqual(Buffer.from(sig, "utf8"), Buffer.from(expected, "utf8"))
	) {
		return null
	}
	try {
		const raw = JSON.parse(
			Buffer.from(data, "base64url").toString("utf8"),
		) as YoutubeOAuthStatePayload
		if (
			typeof raw.u !== "string" ||
			typeof raw.c !== "string" ||
			typeof raw.exp !== "number"
		) {
			return null
		}
		if (raw.exp < Date.now()) {
			return null
		}
		return raw
	} catch {
		return null
	}
}
