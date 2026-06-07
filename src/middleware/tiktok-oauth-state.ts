import { z } from "zod"

import { baseStateSchema, signOAuthState, verifyOAuthState } from "./oauth-state"

const tiktokStateSchema = baseStateSchema.extend({
	/** PKCE code_verifier — passed back to token exchange in the callback. */
	cv: z.string(),
})

export type TiktokOAuthStatePayload = {
	u: string
	c: string
	/** PKCE code_verifier — passed back to token exchange in the callback. */
	cv: string
	exp: number
}

export function signTiktokOAuthState(
	payload: TiktokOAuthStatePayload,
	secret: string,
): string {
	return signOAuthState(payload, secret)
}

export function verifyTiktokOAuthState(
	token: string,
	secret: string,
): TiktokOAuthStatePayload | null {
	return verifyOAuthState(token, secret, tiktokStateSchema)
}
