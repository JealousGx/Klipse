import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Generates a unique temp file path under the OS temp directory. */
export function tmpPath(suffix: string): string {
	return join(tmpdir(), `klipse-${randomUUID()}-${suffix}`);
}

/** Deletes all listed files, ignoring errors (e.g. already deleted). */
export async function cleanupFiles(paths: string[]): Promise<void> {
	await Promise.all(paths.map((p) => unlink(p).catch(() => {})));
}
