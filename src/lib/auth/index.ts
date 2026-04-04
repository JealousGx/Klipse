import "@tanstack/react-start/server-only";

import { betterAuth, type GenericEndpointContext } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";

import { getDb } from "@/db";
import * as schema from "@/db/schema";

import { env } from "@/env";
// import { polarBillingPlugins } from "@/features/auth/polar-plugins";
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
			maxAge: 7 * 60 * 60 * 24,
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
		emailOTP({
			otpLength: OTP_LENGTH,
			expiresIn: OTP_EXPIRATION_SECONDS,
			allowedAttempts: ALLOWED_OTP_ATTEMPTS,
			sendVerificationOnSignUp: true,
			sendVerificationOTP,
			generateOTP:
				process.env.NODE_ENV === "development" ? () => "123456" : undefined,
			overrideDefaultEmailVerification: true,
		}),
		// ...polarBillingPlugins(),
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
	const { email, otp } = data;
	await sendAuthOTPEmail({ email, otp });
}
