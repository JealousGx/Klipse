import { createHmac, timingSafeEqual } from "node:crypto"
import { z } from "zod"

// ---------------------------------------------------------------------------
// Base schema — shared fields across all platform OAuth state tokens
// ---------------------------------------------------------------------------

export const baseStateSchema = z.object({
	u: z.string(),
	c: z.string(),
	exp: z.number(),
})

// ---------------------------------------------------------------------------
// Core sign / verify
// ---------------------------------------------------------------------------

export function signOAuthState<T>(payload: T, secret: string): string {
	const data = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")
	const sig = createHmac("sha256", secret).update(data).digest("base64url")
	return `${data}.${sig}`
}

export function verifyOAuthState<T extends { exp: number }>(
	token: string,
	secret: string,
	schema: z.ZodType<T>,
): T | null {
	const lastDot = token.lastIndexOf(".")
	if (lastDot <= 0) return null

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
		const raw = JSON.parse(Buffer.from(data, "base64url").toString("utf8"))
		const result = schema.safeParse(raw)
		if (!result.success || result.data.exp < Date.now()) return null
		return result.data
	} catch {
		return null
	}
}
