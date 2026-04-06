import "@tanstack/react-start/server-only";

import { env } from "@/env";

export function isAuthorizedVideoProcessorWebhook(request: Request): boolean {
	const secret = env.VIDEO_PROCESSOR_WEBHOOK_SECRET;
	if (!secret) {
		return false;
	}
	const auth = request.headers.get("authorization");
	if (!auth?.startsWith("Bearer ")) {
		return false;
	}
	const token = auth.slice("Bearer ".length);
	return token === secret;
}
