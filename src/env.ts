import { createEnv } from "@t3-oss/env-core"
import { z } from "zod"

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

		/** TikTok app credentials — from developers.tiktok.com → Manage apps. */
		TIKTOK_CLIENT_KEY: z.string().min(1).optional(),
		TIKTOK_CLIENT_SECRET: z.string().min(1).optional(),
		/** HMAC secret for signed `state` in `/api/tiktok/oauth/*` (min 32 chars). */
		TIKTOK_OAUTH_STATE_SECRET: z.string().min(32).optional(),

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

		/** Bearer token for all cron endpoints (cron-job.org or CF Cron Triggers). */
		INTERNAL_CRON_SECRET: z.string().min(1),

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

		// -------------------------------------------------------------------------
		// OpenRouter — script (LLM) + images (FLUX.2)
		// https://openrouter.ai/docs
		// -------------------------------------------------------------------------

		/**
		 * Comma-separated OpenRouter API keys.
		 * Used for both script generation (LLM) and image generation (FLUX.2).
		 * OpenRouter handles provider fallback internally via the `models[]` array.
		 */
		OPENROUTER_API_KEYS: z.string().optional(),
		/**
		 * Primary model for script generation.
		 * @default nvidia/nemotron-nano-12b-v2-vl:free
		 * Other options: google/gemini-2.5-flash, meta-llama/llama-4-scout:free, openai/gpt-oss-120b:free
		 */
		OPENROUTER_SCRIPT_MODEL: z
			.string()
			.min(1)
			.default("google/gemma-4-26b-a4b-it:free"),
		/**
		 * Comma-separated fallback model IDs passed in OpenRouter's `models[]` array.
		 * OpenRouter tries them in order if the primary model fails.
		 * @default google/gemini-2.5-flash,meta-llama/llama-4-scout:free
		 */
		OPENROUTER_SCRIPT_FALLBACK_MODELS: z
			.string()
			.min(1)
			.default(
				"google/gemma-4-26b-a4b-it:free,nvidia/nemotron-nano-12b-v2-vl:free",
			),
		// -------------------------------------------------------------------------
		// Google Gemini — script generation fallback when OpenRouter exhausted
		// https://ai.google.dev/api/generate-content
		// -------------------------------------------------------------------------

		/** Comma-separated Gemini API keys (from Google AI Studio). */
		GEMINI_API_KEYS: z.string().optional(),

		// -------------------------------------------------------------------------
		// Google Cloud TTS — primary TTS (1M Neural2 chars/month free)
		// https://cloud.google.com/text-to-speech
		// -------------------------------------------------------------------------

		/** Comma-separated Google Cloud API keys for Text-to-Speech. */
		GOOGLE_TTS_API_KEYS: z.string().optional(),
		/** @default en-US-Wavenet-G */
		GOOGLE_TTS_VOICE_NAME: z
			.string()
			.min(1)
			.optional()
			.default("en-US-Wavenet-G"),

		// -------------------------------------------------------------------------
		// Replicate — image fallback (FLUX Schnell ~$0.003/image)
		// https://replicate.com
		// -------------------------------------------------------------------------

		/** Comma-separated Replicate API tokens. */
		REPLICATE_API_KEYS: z.string().optional(),

		// -------------------------------------------------------------------------
		// Unreal Speech — TTS fallback (250K chars/month free)
		// https://unrealspeech.com
		// -------------------------------------------------------------------------

		/** Comma-separated Unreal Speech API keys. */
		UNREAL_SPEECH_API_KEYS: z.string().optional(),
		/**
		 * Default voice for Unreal Speech TTS.
		 * @default Scarlett  Options: Scarlett | Dan | Liv | Will | Amy
		 */
		UNREAL_SPEECH_VOICE: z.string().min(1).default("Scarlett"),

		// -------------------------------------------------------------------------
		// ElevenLabs — sound effects (Creator+ only, 10K credits/month free)
		// https://elevenlabs.io/docs/api-reference/sound-generation
		// -------------------------------------------------------------------------

		/** Comma-separated ElevenLabs API keys (rotated via provider-key-execution). */
		ELEVENLABS_API_KEYS: z.string().optional(),
		/**
		 * Default duration (seconds) for generated sound effects.
		 * @default 5  Range: 0.5–22
		 */
		ELEVENLABS_SOUND_DURATION_SECONDS: z.coerce
			.number()
			.min(0.5)
			.max(22)
			.default(5),

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

		// Comma-separated list of emails that should be auto-promoted to admin on login. Only used if the `admin` plugin is enabled.
		ADMIN_EMAILS: z.string().optional(),

		/**
		 * Set to "false" to block all new user registrations (email OTP, password, social).
		 * Existing users can still sign in. Toggle via env var — no redeploy needed on Cloud Run.
		 * @default "true"
		 */
		REGISTRATION_ENABLED: z
			.enum(["true", "false"])
			.default("true")
			.transform((v) => v === "true"),

		DISCORD_BUG_REPORT_WEBHOOK_URL: z.url(),

		// -------------------------------------------------------------------------
		// Sentry — error tracking (optional; no-op when absent)
		// https://sentry.io
		// -------------------------------------------------------------------------
		// -------------------------------------------------------------------------
		// Axiom — structured log drain (optional; no-op when absent)
		// https://axiom.co
		// -------------------------------------------------------------------------
		/** Axiom API token with Ingest permission on AXIOM_DATASET. */
		AXIOM_API_TOKEN: z.string().min(1).optional(),
		/** Axiom dataset name to ingest into. @default "klipse" */
		AXIOM_DATASET: z.string().min(1).default("klipse"),

		/** Server-side Sentry DSN. Get from: Sentry project → Settings → Client Keys. */
		SENTRY_DSN: z.url().optional(),
		/**
		 * Sentry auth token for source map upload during `vite build`.
		 * Get from: Sentry → Settings → Auth Tokens → Create Internal Token (project:releases + org:read).
		 * Only needed at build time — never sent to browser.
		 */
		SENTRY_AUTH_TOKEN: z.string().min(1).optional(),
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
		VITE_APP_DISCORD_URL: z.url().optional(),
		VITE_APP_FEATURE_BASE_URL: z.url().optional(),
		/** Client-side Sentry DSN (safe to expose — public key only). */
		VITE_APP_SENTRY_DSN: z.url().optional(),
		/** Mirrors server REGISTRATION_ENABLED for UI gating. Default true (open). */
		VITE_REGISTRATION_ENABLED: z
			.enum(["true", "false"])
			.default("true")
			.transform((v) => v === "true"),
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
})
