import type { DBFieldAttribute } from "better-auth/db";

/**
 * Better Auth `user.additionalFields` — matches `users` table columns.
 * `input: false` so clients cannot set billing fields via sign-up or `updateUser`.
 *
 * @see https://www.better-auth.com/docs/concepts/typescript#additional-fields
 */
export const additionalUserFields = {
	plan: {
		type: "string",
		input: false,
		required: false,
	},
	creditsRemaining: {
		type: "number",
		input: false,
		required: false,
	},
	creditsUsed: {
		type: "number",
		input: false,
		required: false,
	},
	freeVideoConsumed: {
		type: "boolean",
		input: false,
		required: false,
	},
} satisfies Record<string, DBFieldAttribute>;
