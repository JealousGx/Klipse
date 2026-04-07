import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
	server: {
		/**
		 * Deployment label (`local`, `development`, `staging`, `production`). Defaults to `local` for dev.
		 */
		ENVIRONMENT: z
			.enum(["local", "development", "production", "staging"])
			.default("local"),

		SERVER_URL: z.url().optional(),
		DATABASE_URL: z.string(),

		GOOGLE_CLIENT_ID: z.string(),
		GOOGLE_CLIENT_SECRET: z.string(),

		/** HMAC secret for signed `state` in `/api/youtube/oauth/*` (min 32 chars). */
		YOUTUBE_OAUTH_STATE_SECRET: z.string().min(32),

		WORKER_API_URL: z.url(),
		WORKER_SECRET: z.string(),

		R2_ACCOUNT_ID: z.string(),
		R2_ACCESS_KEY_ID: z.string(),
		R2_SECRET_ACCESS_KEY: z.string(),
		R2_BUCKET_NAME: z.string(),
		R2_PUBLIC_BASE_URL: z.url(),

		RESEND_API_KEY: z.string(),
		EMAIL_FROM: z.email(),

		POLAR_WEBHOOK_SECRET: z.string(),
		POLAR_ACCESS_TOKEN: z.string(),
		POLAR_SERVER: z.enum(["sandbox", "production"]).default("sandbox"),
		POLAR_PRODUCT_STARTER: z.string(),
		POLAR_PRODUCT_CREATOR: z.string(),
		POLAR_PRODUCT_EMPIRE: z.string(),
		POLAR_PRODUCT_CREDITS: z.string(),
		POLAR_PRODUCT_CREDITS_LARGE: z.string(),

		/** Bearer token for optional crons (e.g. `POST /api/cron/purge-expiring-assets` — purges expired R2 assets). */
		INTERNAL_CRON_SECRET: z.string().min(1).optional(),

		/**
		 * External encoder service (FFmpeg lives here only). Required for any assembly job;
		 * the main app never encodes video.
		 */
		VIDEO_PROCESSOR_URL: z.url().optional(),
		/** App → processor: `Authorization` bearer the processor verifies. */
		VIDEO_PROCESSOR_CLIENT_SECRET: z.string().min(16).optional(),
		/** Processor → app webhook: `Authorization` bearer for `/api/internal/video-processor/assembly-complete`. */
		VIDEO_PROCESSOR_WEBHOOK_SECRET: z.string().min(16).optional(),
		/**
		 * Public base URL of this app (webhook + handoff). Falls back to `SERVER_URL` when unset.
		 */
		APP_PUBLIC_URL: z.url().optional(),

		/** Pollinations Gen API (text/image/audio). Keys from https://enter.pollinations.ai */
		POLLINATIONS_GEN_BASE: z.url().optional(),
		POLLINATIONS_API_KEY: z.string().min(1).optional(),
		/** Text model id for `POST /v1/chat/completions` (e.g. mistral, claude-fast). */
		POLLINATIONS_TEXT_MODEL: z.string().min(1).optional(),

		/** Comma-separated Google AI Studio keys for Gemini (primary script provider). */
		GEMINI_API_KEYS: z.string().optional(),
		/** @default gemini-2.0-flash */
		GEMINI_SCRIPT_MODEL: z.string().min(1).default("gemini-2.0-flash"),

		/** Comma-separated Google Cloud API keys for Text-to-Speech (primary audio provider). */
		GOOGLE_TTS_API_KEYS: z.string().optional(),
		GOOGLE_TTS_VOICE_NAME: z.string().min(1).optional(),

		/**
		 * Better Auth `session.cookieCache.maxAge` (seconds). After Polar checkout we
		 * bypass cache once via `?checkout=success` on billing; keep this high to avoid
		 * extra DB reads on routine `get-session` calls.
		 * @default 604800 (7d)
		 */
		SESSION_COOKIE_CACHE_MAX_AGE_SECONDS: z.coerce
			.number()
			.int()
			.min(60)
			.max(604800)
			.default(604800),
	},

	/**
	 * The prefix that client-side variables must have. This is enforced both at
	 * a type-level and at runtime.
	 */
	clientPrefix: "VITE_",

	client: {
		VITE_APP_TITLE: z.string().min(1).optional(),
		VITE_APP_URL: z.url(),
		VITE_APP_R2_PUBLIC_BASE_URL: z.url(),
		VITE_APP_SUPPORT_EMAIL: z.email(),
	},

	/**
	 * What object holds the environment variables at runtime. This is usually
	 * `process.env` or `import.meta.env`.
	 */
	runtimeEnv: {
		...import.meta.env,
		...process.env,
	},

	/**
	 * By default, this library will feed the environment variables directly to
	 * the Zod validator.
	 *
	 * This means that if you have an empty string for a value that is supposed
	 * to be a number (e.g. `PORT=` in a ".env" file), Zod will incorrectly flag
	 * it as a type mismatch violation. Additionally, if you have an empty string
	 * for a value that is supposed to be a string with a default value (e.g.
	 * `DOMAIN=` in an ".env" file), the default value will never be applied.
	 *
	 * In order to solve these issues, we recommend that all new projects
	 * explicitly specify this option as true.
	 */
	emptyStringAsUndefined: true,
});
