import { createHash } from "node:crypto";

/** Stable 64-char hex id for an API secret (env keys have no DB row). */
export function secretFingerprint(secret: string): string {
	return createHash("sha256").update(secret, "utf8").digest("hex");
}
