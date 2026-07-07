import "@tanstack/react-start/server-only"

import { env } from "@/env"

const TOKEN_URL = "https://oauth2.googleapis.com/token"
const SCOPE = "https://www.googleapis.com/auth/cloud-platform"
const TOKEN_LIFETIME_SECONDS = 3600
// Refresh a bit before actual expiry so a token is never used right at the edge.
const REFRESH_SKEW_SECONDS = 120

let cachedToken: { accessToken: string; expiresAtMs: number } | null = null

function base64UrlEncodeBytes(bytes: Uint8Array): string {
	let binary = ""
	for (const byte of bytes) binary += String.fromCharCode(byte)
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function base64UrlEncodeString(value: string): string {
	return base64UrlEncodeBytes(new TextEncoder().encode(value))
}

function pemToPkcs8(pem: string): ArrayBuffer {
	// Private keys stored as env vars/CF secrets commonly carry literal `\n` escapes
	// instead of real newlines (single-line-safe) — unescape before stripping headers.
	const normalized = pem.replace(/\\n/g, "\n")
	const base64 = normalized
		.replace(/-----BEGIN PRIVATE KEY-----/, "")
		.replace(/-----END PRIVATE KEY-----/, "")
		.replace(/\s+/g, "")
	const binary = atob(base64)
	const bytes = new Uint8Array(binary.length)
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
	return bytes.buffer
}

async function signJwtAssertion(
	clientEmail: string,
	privateKeyPem: string,
): Promise<string> {
	const now = Math.floor(Date.now() / 1000)
	const header = { alg: "RS256", typ: "JWT" }
	const claims = {
		iss: clientEmail,
		scope: SCOPE,
		aud: TOKEN_URL,
		iat: now,
		exp: now + TOKEN_LIFETIME_SECONDS,
	}
	const signingInput = `${base64UrlEncodeString(JSON.stringify(header))}.${base64UrlEncodeString(JSON.stringify(claims))}`

	const key = await crypto.subtle.importKey(
		"pkcs8",
		pemToPkcs8(privateKeyPem),
		{ name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
		false,
		["sign"],
	)
	const signature = await crypto.subtle.sign(
		"RSASSA-PKCS1-v1_5",
		key,
		new TextEncoder().encode(signingInput),
	)
	return `${signingInput}.${base64UrlEncodeBytes(new Uint8Array(signature))}`
}

/**
 * Mints (and in-memory caches across requests on a warm isolate) a short-lived OAuth
 * access token for the GCP service account, via the standard JWT-bearer server-to-server
 * flow — signed with Web Crypto (`crypto.subtle`), not `google-auth-library`, which
 * doesn't run on the Cloudflare Workers runtime this app is deployed on.
 */
export async function getGcpAccessToken(): Promise<string> {
	const clientEmail = env.GCP_SERVICE_ACCOUNT_EMAIL?.trim()
	const privateKey = env.GCP_SERVICE_ACCOUNT_PRIVATE_KEY?.trim()
	if (!clientEmail || !privateKey) {
		throw new Error(
			"GCP_SERVICE_ACCOUNT_EMAIL and GCP_SERVICE_ACCOUNT_PRIVATE_KEY required",
		)
	}

	const now = Date.now()
	if (cachedToken && cachedToken.expiresAtMs - REFRESH_SKEW_SECONDS * 1000 > now) {
		return cachedToken.accessToken
	}

	const assertion = await signJwtAssertion(clientEmail, privateKey)
	const res = await fetch(TOKEN_URL, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
			assertion,
		}),
	})
	if (!res.ok) {
		const text = await res.text().catch(() => "")
		throw new Error(`gcp_token_exchange_failed:${res.status}:${text.slice(0, 300)}`)
	}
	const data = (await res.json()) as { access_token: string; expires_in: number }
	cachedToken = {
		accessToken: data.access_token,
		expiresAtMs: now + data.expires_in * 1000,
	}
	return cachedToken.accessToken
}
