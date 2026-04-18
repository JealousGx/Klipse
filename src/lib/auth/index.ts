import "@tanstack/react-start/server-only";

import { betterAuth, type GenericEndpointContext } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { admin, emailOTP } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";

import { getDb } from "@/db";
import * as schema from "@/db/schema";
import { siteSettings } from "@/db/schema/site-settings";

import { env } from "@/env";
import { createPolarBillingPlugin } from "@/features/billing/polar-plugin.server";
import { additionalUserFields } from "@/lib/auth/additional-user-fields";
import { ac, adminRoles } from "@/lib/auth/admin-access-control";
import { sendAuthOTPEmail } from "@/lib/email/auth-otp";
import { accountId, sessionId, userId, verificationId } from "@/lib/id";

const OTP_LENGTH = 6;
const OTP_EXPIRATION_SECONDS = 600;
const ALLOWED_OTP_ATTEMPTS = 5;

export const auth = betterAuth({
	baseURL: env.SERVER_URL ?? "http://localhost:3000",
	database: drizzleAdapter(getDb(), {
		provider: "mysql",
		schema,
		usePlural: true,
	}),

	session: {
		cookieCache: {
			enabled: true,
			maxAge: env.SESSION_COOKIE_CACHE_MAX_AGE_SECONDS,
		},
	},

	user: {
		additionalFields: additionalUserFields,
	},

	databaseHooks: {
		user: {
			create: {
				before: async (_user) => {
					// Env var override — emergency kill switch, wins over DB
					if (!env.REGISTRATION_ENABLED) {
						throw new APIError("FORBIDDEN", {
							message:
								"Registration is currently disabled. Please try again later.",
						});
					}
					// DB flag — admin dashboard toggle
					const [row] = await getDb()
						.select({ registrationEnabled: siteSettings.registrationEnabled })
						.from(siteSettings)
						.limit(1);
					if (row?.registrationEnabled === false) {
						throw new APIError("FORBIDDEN", {
							message:
								"Registration is currently disabled. Please try again later.",
						});
					}
				},
			},
		},
	},

	emailAndPassword: {
		enabled: true,
	},
	socialProviders:
		env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
			? {
					google: {
						clientId: env.GOOGLE_CLIENT_ID,
						clientSecret: env.GOOGLE_CLIENT_SECRET,
					},
				}
			: undefined,
	plugins: [
		admin({
			// Only the "admin" role gets access to admin endpoints.
			// The "user" role is the default for all new accounts.
			defaultRole: "user",
			adminRoles: ["admin"],
			// Custom RBAC — lets us define fine-grained permissions per role
			// as we add more team members in the future.
			ac,
			roles: adminRoles,
		}),

		emailOTP({
			otpLength: OTP_LENGTH,
			expiresIn: OTP_EXPIRATION_SECONDS,
			allowedAttempts: ALLOWED_OTP_ATTEMPTS,
			sendVerificationOnSignUp: true,
			sendVerificationOTP,
			...(["local", "development"].includes(env.ENVIRONMENT) && {
				generateOTP: () => "123456",
			}), // hard coded OTP for local and development environments. default behavior for production.
			overrideDefaultEmailVerification: true,
		}),
		createPolarBillingPlugin(),
		tanstackStartCookies(),
	],

	advanced: {
		database: {
			generateId: ({ model }) => {
				switch (model) {
					case "user": {
						return userId();
					}
					case "session": {
						return sessionId();
					}
					case "account": {
						return accountId();
					}
					case "verification": {
						return verificationId();
					}
					default: {
						return false;
					}
				}
			},
		},
	},
});

async function sendVerificationOTP(
	data: {
		email: string;
		otp: string;
		type: "sign-in" | "email-verification" | "forget-password" | "change-email";
	},
	_ctx?: GenericEndpointContext | undefined,
) {
	const { email, otp, type } = data;

	if (env.ENVIRONMENT === "local" || env.ENVIRONMENT === "development") {
		console.log(`[dev OTP] ${otp} for ${email} (${type})`);
		return;
	}

	await sendAuthOTPEmail({ email, otp });
}
