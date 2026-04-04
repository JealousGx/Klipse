/**
 * Map Better Auth client action results to a user-visible message.
 * Returns `null` when the action succeeded (no error).
 */
export function readBetterAuthActionError(
	result: {
		error?: { message?: string; status?: number } | null;
		data?: unknown;
	},
	fallback: string,
): string | null {
	if (result.error) {
		return result.error.message?.trim() || fallback;
	}
	return null;
}
