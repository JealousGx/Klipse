import type { Env } from "./env";

export function trimTrailingSlash(url: string): string {
	return url.replace(/\/+$/, "");
}

/**
 * Calls the main app — the only place with DB + Polar SDK credentials.
 */
export async function callMainAppDrain(env: Env, limit: number): Promise<void> {
	const base = trimTrailingSlash(env.MAIN_APP_URL);
	const url = `${base}/api/internal/worker/polar-usage-sync/drain`;

	const res = await fetch(url, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${env.WORKER_SECRET}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ limit }),
	});

	if (!res.ok) {
		const text = await res.text();
		throw new Error(`main drain ${res.status}: ${text}`);
	}
}
