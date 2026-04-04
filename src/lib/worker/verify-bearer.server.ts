import { env } from "@/env";

/**
 * `Authorization: Bearer` shared with Cloudflare Worker (`WORKER_SECRET`) and optional
 * legacy cron (`INTERNAL_CRON_SECRET`).
 */
export function isAuthorizedWorkerOrInternalCron(request: Request): boolean {
	const auth = request.headers.get("authorization");
	if (!auth?.startsWith("Bearer ")) {
		return false;
	}
	const token = auth.slice("Bearer ".length);
	if (token === env.WORKER_SECRET) {
		return true;
	}
	if (env.INTERNAL_CRON_SECRET && token === env.INTERNAL_CRON_SECRET) {
		return true;
	}
	return false;
}
