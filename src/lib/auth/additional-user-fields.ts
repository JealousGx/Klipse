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
		required: true,
	},
	creditsRemaining: {
		type: "number",
		input: false,
		required: true,
	},
	creditsUsed: {
		type: "number",
		input: false,
		required: true,
	},
	freeVideoConsumed: {
		type: "boolean",
		input: false,
		required: true,
	},
} satisfies Record<string, DBFieldAttribute>;
