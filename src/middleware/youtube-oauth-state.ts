import { baseStateSchema, signOAuthState, verifyOAuthState } from "./oauth-state"

const youtubeStateSchema = baseStateSchema

export type YoutubeOAuthStatePayload = {
	u: string
	c: string
	exp: number
}

export function signYoutubeOAuthState(
	payload: YoutubeOAuthStatePayload,
	secret: string,
): string {
	return signOAuthState(payload, secret)
}

export function verifyYoutubeOAuthState(
	token: string,
	secret: string,
): YoutubeOAuthStatePayload | null {
	return verifyOAuthState(token, secret, youtubeStateSchema)
}
