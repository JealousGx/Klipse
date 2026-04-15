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
				console.warn(
					`[retry] ${label} attempt ${attempt}/${attempts} failed (final)`,
					e,
				);
				break;
			}
			const delay = BASE_MS * 2 ** (attempt - 1);
			console.warn(
				`[retry] ${label} attempt ${attempt}/${attempts} failed; retry in ${delay}ms`,
				e,
			);
			await sleep(delay);
		}
	}
	throw last instanceof Error
		? last
		: new Error(`${label}_failed:${String(last)}`);
}
