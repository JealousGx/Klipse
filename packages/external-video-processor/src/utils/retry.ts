import { logger } from "./logger";

const BASE_MS = 500;

export function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}

/**
 * Retries `fn` up to `attempts` times with exponential backoff.
 * Logs warnings on each failure; re-throws on final attempt.
 */
export async function withRetries<T>(
	label: string,
	attempts: number,
	fn: (attempt: number) => Promise<T>,
): Promise<T> {
	let last: unknown;
	for (let attempt = 1; attempt <= attempts; attempt++) {
		try {
			return await fn(attempt);
		} catch (e) {
			last = e;
			if (attempt === attempts) {
				logger.warn("retry_attempt_failed_final", {
					label,
					attempt,
					attempts,
					error: e instanceof Error ? e.message : String(e),
				});
				break;
			}
			const delay = BASE_MS * 2 ** (attempt - 1);
			logger.warn("retry_attempt_failed", {
				label,
				attempt,
				attempts,
				delayMs: delay,
				error: e instanceof Error ? e.message : String(e),
			});
			await sleep(delay);
		}
	}
	throw last instanceof Error
		? last
		: new Error(`${label}_failed:${String(last)}`);
}
