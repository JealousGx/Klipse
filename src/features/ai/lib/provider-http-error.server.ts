import "@tanstack/react-start/server-only";

/** Thrown when an upstream AI HTTP call fails; used for key rotation / cooldown. */
export class ProviderHttpError extends Error {
	override readonly cause?: unknown;

	constructor(
		readonly status: number,
		readonly bodySnippet: string,
		readonly providerLabel: string,
		cause?: unknown,
		/** From `Retry-After` when callers pass it through {@link throwProviderHttpError}. */
		readonly retryAfterAt?: Date,
	) {
		super(
			`${providerLabel}_${status}:${bodySnippet.slice(0, 200)}`,
		);
		this.name = "ProviderHttpError";
		this.cause = cause;
	}
}

export function isProviderHttpError(e: unknown): e is ProviderHttpError {
	return e instanceof ProviderHttpError;
}
