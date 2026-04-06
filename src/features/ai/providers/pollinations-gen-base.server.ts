import "@tanstack/react-start/server-only";

import { env } from "@/env";

export function genBase(): string {
	return (
		env.POLLINATIONS_GEN_BASE?.trim() || "https://gen.pollinations.ai"
	).replace(/\/$/, "");
}
