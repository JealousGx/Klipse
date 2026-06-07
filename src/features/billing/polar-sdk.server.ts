import "@tanstack/react-start/server-only"

import { Polar } from "@polar-sh/sdk"

import { env } from "@/env"

let _polar: Polar | undefined

/** Shared Polar SDK client (checkout, webhooks, usage, and raw `events.ingest`). */
export function getPolarSdk(): Polar {
	if (!_polar) {
		_polar = new Polar({
			accessToken: env.POLAR_ACCESS_TOKEN,
			server: env.POLAR_SERVER,
		})
	}
	return _polar
}
