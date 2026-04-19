# Klipse

AI-powered video creation and publishing SaaS. Turns a user's text idea into a fully produced short-form video — AI script, TTS narration, generated images, FFmpeg encode — and auto-publishes to YouTube (with TikTok/Instagram on the roadmap).

---

## Table of Contents

- [What it does](#what-it-does)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Local Development Setup](#local-development-setup)
- [Environment Variables](#environment-variables)
- [Key Scripts](#key-scripts)
- [Project Structure](#project-structure)
- [Database](#database)
- [Video Pipeline](#video-pipeline)
- [AI Providers](#ai-providers)
- [Billing & Subscription Tiers](#billing--subscription-tiers)
- [Authentication](#authentication)
- [Observability](#observability)
- [Deployment](#deployment)
- [Code Conventions](#code-conventions)
- [Deep-Dive Docs](#deep-dive-docs)

---

## What it does

1. User submits a video idea (e.g. "10 facts about black holes")
2. Klipse generates an AI script (Gemini 2.5 Flash → fallback chain)
3. Processor generates images (Replicate SDXL), TTS narration (Google Cloud TTS → Unreal Speech fallback), and optional sound (ElevenLabs) — all locally in `/tmp/`
4. Processor encodes `output.mp4` via FFmpeg, uploads only the final video to Cloudflare R2
5. Processor calls webhook back to main app
6. App marks job complete, triggers YouTube publish (auto-post or pending-approval per channel config)

---

## Tech Stack

| Layer          | Technology                                                          |
| -------------- | ------------------------------------------------------------------- |
| Framework      | TanStack Start (React 19 + Vite 7)                                  |
| Routing        | TanStack Router (file-based)                                        |
| State / Data   | TanStack Query + TanStack Store                                     |
| Styling        | Tailwind CSS 4 + Shadcn UI + Radix UI                               |
| Database       | MySQL (TiDB serverless in prod) + Drizzle ORM                       |
| Auth           | Better Auth (Email OTP + Google OAuth + Polar plugin)               |
| Storage        | Cloudflare R2 (S3-compatible)                                       |
| AI — Script    | Gemini 2.5 Flash (primary) → OpenRouter (fallback)                  |
| AI — Images    | Replicate SDXL (default) — processor-side                           |
| AI — TTS       | Google Cloud TTS (primary) → Unreal Speech / ElevenLabs (fallbacks) |
| Job Dispatch   | Cron polling (`/api/cron/dispatch-queued-jobs`, ~1min interval)     |
| Video Encoding | External Hono/Node service (Docker, FFmpeg)                         |
| Billing        | Polar (subscriptions + usage metering)                              |
| Email          | Resend                                                              |
| Error Tracking | Sentry                                                              |
| Observability  | Structured JSON logging → CF Observability Logs → Axiom             |
| Linting/Fmt    | Biome 2.x                                                           |
| Package Mgr    | pnpm 10 (monorepo)                                                  |
| Node           | >=23.0.0                                                            |

---

## Architecture

Two runtime services:

```
┌─────────────────────────────────────┐
│  Main App (TanStack Start / CF)     │  :3000 (dev) / klipse.app (prod)
│  src/  — SSR React + server fns     │
│  MySQL ← Drizzle ORM                │
│  Cloudflare R2 (uploads)            │
│                                     │
│  Cron: /api/cron/dispatch-queued-   │
│  jobs fires every ~1min, picks up   │
│  queued jobs → dispatches to        │
│  processor                          │
└──────────────┬──────────────────────┘
               │ POST /v1/process-spec
               ▼
┌─────────────────────────────────────┐
│  External Video Processor           │  :8790 (dev) / Cloud Run (prod)
│  packages/external-video-processor/ │
│  Hono + FFmpeg — Docker container   │
│  Script → Assets → Encode → R2      │
│  → POST callback back to main app   │
└─────────────────────────────────────┘
```

Main app deploys as a **Cloudflare Worker** (`wrangler deploy`). Job dispatch is cron-driven — no separate CF Worker/Queue consumer. The video processor runs separately as a Docker container (local) or GCP Cloud Run service (prod).

---

## Prerequisites

- **Node.js** >= 23.0.0
- **pnpm** 10.x (`corepack enable && corepack prepare pnpm@latest --activate`)
- **Docker** (for local MySQL + video processor)

---

## Local Development Setup

```bash
# 1. Clone and install
git clone https://github.com/JealousGx/Klipse
cd klipse
pnpm install

# 2. Copy and fill env
cp .env.example .env.local
# Minimum required: DATABASE_URL, BETTER_AUTH_SECRET, SERVER_URL
# See Environment Variables section for full reference

# 3. Start MySQL via Docker Compose
pnpm db:setup

# 4. Run migrations
pnpm db:migrate

# 5. Start the main app (port 3000)
pnpm dev
```

### Optional: Video Processor

FFmpeg encoder for full content pipeline jobs.

```bash
pnpm processor:docker:setup    # Build + start Docker container on :8790
pnpm processor:docker:logs  # Stream processor logs
```

---

## Environment Variables

Copy `.env.example` → `.env.local`. Variables marked **required** must be set for the feature to work.

### Core

| Variable             | Required | Description                                                                          |
| -------------------- | -------- | ------------------------------------------------------------------------------------ |
| `DATABASE_URL`       | ✅       | MySQL connection string (`mysql://user:pass@host:3306/db`)                           |
| `BETTER_AUTH_SECRET` | ✅       | Random secret — generate: `npx -y @better-auth/cli secret`                           |
| `BETTER_AUTH_URL`    | ✅       | Auth base URL (`http://localhost:3000` for dev)                                      |
| `SERVER_URL`         | ✅       | Public app origin — used for OAuth redirects                                         |
| `APP_PUBLIC_URL`     | ✅       | App URL reachable from Docker (use `http://host.docker.internal:3000` for processor) |
| `ENVIRONMENT`        |          | Deployment label: `local` / `development` / `staging` / `production`                 |

### Google OAuth + YouTube

| Variable                     | Required | Description                                                       |
| ---------------------------- | -------- | ----------------------------------------------------------------- |
| `GOOGLE_CLIENT_ID`           |          | OAuth client ID (enables Google sign-in + YouTube connect)        |
| `GOOGLE_CLIENT_SECRET`       |          | OAuth client secret                                               |
| `YOUTUBE_OAUTH_STATE_SECRET` |          | CSRF token secret for YouTube OAuth flow (`openssl rand -hex 32`) |

> In Google Cloud Console: add `https://<host>/api/youtube/oauth/callback` as authorized redirect URI and enable **YouTube Data API v3**.

### Storage (Cloudflare R2)

| Variable               | Required | Description                        |
| ---------------------- | -------- | ---------------------------------- |
| `R2_ACCOUNT_ID`        | ✅       | Cloudflare account ID              |
| `R2_ACCESS_KEY_ID`     | ✅       | R2 access key                      |
| `R2_SECRET_ACCESS_KEY` | ✅       | R2 secret key                      |
| `R2_BUCKET_NAME`       | ✅       | Bucket name                        |
| `R2_PUBLIC_BASE_URL`   | ✅       | Public CDN base URL for the bucket |

> Configure bucket CORS to allow presigned PUT uploads from your origin.

### Video Processor

| Variable                         | Required | Description                                                      |
| -------------------------------- | -------- | ---------------------------------------------------------------- |
| `VIDEO_PROCESSOR_URL`            | ✅       | Processor base URL (`http://localhost:8790` for dev)             |
| `VIDEO_PROCESSOR_CLIENT_SECRET`  | ✅       | Bearer secret — app → processor (`openssl rand -hex 32`)         |
| `VIDEO_PROCESSOR_WEBHOOK_SECRET` | ✅       | Bearer secret — processor → app webhook (`openssl rand -hex 32`) |

### AI Providers

| Variable                 | Description                                                        |
| ------------------------ | ------------------------------------------------------------------ |
| `GEMINI_API_KEYS`        | Comma-separated Google AI Studio keys (script generation, primary) |
| `GEMINI_SCRIPT_MODEL`    | Model override (default: `gemini-2.5-flash`)                       |
| `OPENROUTER_API_KEYS`    | Comma-separated OpenRouter keys (script fallback)                  |
| `GOOGLE_TTS_API_KEYS`    | Comma-separated Google Cloud TTS keys (TTS primary)                |
| `GOOGLE_TTS_VOICE_NAME`  | Voice override (default: `en-US-Wavenet-G`)                        |
| `UNREAL_SPEECH_API_KEYS` | Comma-separated Unreal Speech keys (TTS fallback)                  |
| `ELEVENLABS_API_KEYS`    | Comma-separated ElevenLabs keys (sound effects)                    |
| `REPLICATE_API_KEYS`     | Comma-separated Replicate keys (image generation)                  |

> All AI provider keys are stored in `provider_api_keys` DB table with cooldown/failure tracking. Env vars are materialized into the table on first use if no rows exist for that provider.

### Billing (Polar)

| Variable                      | Required | Description                                                                            |
| ----------------------------- | -------- | -------------------------------------------------------------------------------------- |
| `POLAR_ACCESS_TOKEN`          | ✅       | Polar API token                                                                        |
| `POLAR_WEBHOOK_SECRET`        | ✅       | Webhook signing secret (set webhook URL to `https://<domain>/api/auth/polar/webhooks`) |
| `POLAR_SERVER`                |          | `sandbox` (default for dev) or `production`                                            |
| `POLAR_PRODUCT_STARTER`       |          | Polar product ID for Starter tier                                                      |
| `POLAR_PRODUCT_CREATOR`       |          | Polar product ID for Creator tier                                                      |
| `POLAR_PRODUCT_EMPIRE`        |          | Polar product ID for Empire tier                                                       |
| `POLAR_PRODUCT_CREDITS`       |          | Polar product ID for 1k credit pack                                                    |
| `POLAR_PRODUCT_CREDITS_LARGE` |          | Polar product ID for 3k credit pack                                                    |

> Usage meter in Polar: Name = `klipse.usage`, Aggregation = **Sum** on metadata key `credits`.

### Email (Resend)

| Variable         | Required | Description                           |
| ---------------- | -------- | ------------------------------------- |
| `RESEND_API_KEY` | ✅       | Resend API key                        |
| `EMAIL_FROM`     | ✅       | From address for transactional emails |

### Error Tracking (Sentry)

| Variable              | Description             |
| --------------------- | ----------------------- |
| `SENTRY_DSN`          | Server-side Sentry DSN  |
| `VITE_APP_SENTRY_DSN` | Client-side Sentry DSN  |
| `SENTRY_AUTH_TOKEN`   | Source map upload token |

### Cron

| Variable               | Required | Description                                                       |
| ---------------------- | -------- | ----------------------------------------------------------------- |
| `INTERNAL_CRON_SECRET` | ✅       | Bearer token for `/api/cron/*` endpoints (`openssl rand -hex 32`) |

### Observability

| Variable          | Description                                                                  |
| ----------------- | ---------------------------------------------------------------------------- |
| `KLIPSE_PERF_LOG` | Set to `1` to enable `info`-level structured logs in production              |
| `AXIOM_API_TOKEN` | Axiom ingest token (direct drain — processor only; main app uses CF Logpush) |
| `AXIOM_DATASET`   | Axiom dataset name (default: `klipse`)                                       |

> In production (Cloudflare Workers), logs flow via **CF Observability Logs → Axiom OTLP**. Set `KLIPSE_PERF_LOG=1` in `wrangler.jsonc` `vars` to enable `info`-level logs.

### Feature Flags

| Variable                    | Default | Description                                        |
| --------------------------- | ------- | -------------------------------------------------- |
| `REGISTRATION_ENABLED`      | `true`  | Server-side kill switch — blocks new user creation |
| `VITE_REGISTRATION_ENABLED` | `true`  | Client-side flag — hides sign-up UI                |

### Client / UI

| Variable                    | Description                            |
| --------------------------- | -------------------------------------- |
| `VITE_APP_TITLE`            | App title shown in UI                  |
| `VITE_APP_URL`              | Canonical public URL for SEO / OG tags |
| `VITE_APP_SUPPORT_EMAIL`    | Support email shown in UI              |
| `VITE_APP_DISCORD_URL`      | Discord invite URL                     |
| `VITE_APP_FEATURE_BASE_URL` | Featurebase feedback URL               |

### Admin

| Variable       | Description                                            |
| -------------- | ------------------------------------------------------ |
| `ADMIN_EMAILS` | Comma-separated emails auto-promoted to admin on login |

---

## Key Scripts

### Main App

```bash
pnpm dev                  # Dev server on :3000
pnpm build                # Production build (runs db:migrate first)
pnpm preview              # Preview production build locally
pnpm deploy               # Build + wrangler deploy to Cloudflare
pnpm test                 # Run Vitest tests
pnpm lint                 # Biome lint
pnpm format               # Biome format
pnpm check                # Biome check (lint + format)
```

### Database

```bash
pnpm db:setup             # Docker Compose MySQL (wipes + restarts)
pnpm db:generate          # Generate migration files from schema changes
pnpm db:migrate           # Apply pending migrations
pnpm db:push              # Push schema directly (dev shortcut, no migration file)
pnpm db:pull              # Pull schema from existing DB
pnpm db:studio            # Drizzle Studio GUI at :4983
```

### Video Processor (Docker)

```bash
pnpm processor:docker:setup   # Build + start processor container (:8790)
pnpm processor:docker:down    # Stop processor container
pnpm processor:docker:logs    # Stream processor logs
pnpm processor:typecheck      # Type-check processor package
```

---

## Project Structure

```
klipse/
├── src/
│   ├── routes/                    # File-based routes (TanStack Router)
│   │   ├── __root.tsx             # Root layout
│   │   ├── index.tsx              # Landing page
│   │   ├── dashboard/             # Authenticated app pages
│   │   │   ├── index.tsx          # Dashboard home
│   │   │   ├── generate.tsx       # Video generation UI
│   │   │   ├── jobs.tsx           # Job history
│   │   │   ├── publishing.tsx     # Publishing destinations
│   │   │   ├── analytics.tsx
│   │   │   ├── billing.tsx
│   │   │   └── settings.tsx
│   │   └── api/                   # Server API routes
│   │       ├── auth/$             # Better Auth endpoints
│   │       ├── youtube/oauth/*    # YouTube OAuth flow
│   │       ├── internal/worker/*  # Worker → app internal APIs
│   │       ├── internal/video-processor/*   # Processor webhook callbacks
│   │       └── cron/             # Scheduled cron tasks
│   ├── features/                  # Feature modules
│   │   ├── ai/                    # AI providers, script gen, prompts, API key management
│   │   ├── auth/                  # Auth UI + session helpers
│   │   ├── billing/               # Polar, credits, tiers, metering
│   │   ├── channels/              # Publishing channel management
│   │   ├── entitlements/          # Access control, quota checks
│   │   ├── publishing/            # Platform-specific publish logic
│   │   ├── user/                  # User profile
│   │   ├── video/                 # Video pipeline + job management
│   │   │   └── pipeline/          # Pipeline stages (dispatch, stub, content)
│   │   └── youtube/               # YouTube OAuth + token management + publishing
│   ├── db/
│   │   ├── index.ts               # DB connection (singleton)
│   │   └── schema/                # Drizzle table definitions
│   ├── lib/                       # Shared utilities
│   │   ├── auth/                  # Better Auth instance + RBAC
│   │   ├── storage/               # R2 helpers + presigned URLs
│   │   ├── email/                 # Resend / OTP emails
│   │   ├── logger.ts              # Structured JSON logger
│   │   └── id.ts                  # UUIDv7 ID generators
│   ├── components/                # Reusable UI components
│   └── env.ts                     # T3Env schema (type-safe env vars)
├── packages/
│   ├── external-video-processor/  # FFmpeg encoding service (Hono)
│   └── video-assembly-shared/     # Shared types: main app ↔ processor
├── docker/
│   └── external-video-processor/  # Docker Compose + Dockerfile
├── drizzle/                       # Generated migration files (commit these)
├── wrangler.jsonc                  # Cloudflare Worker config
├── biome.json                      # Lint/format config
└── drizzle.config.ts               # ORM config
```

---

## Database

**Engine:** MySQL 8 (local via Docker Compose, production via TiDB Cloud serverless)

**Key tables:**

| Table                 | Purpose                                                                |
| --------------------- | ---------------------------------------------------------------------- |
| `users`               | Accounts, plan tier, credit balance                                    |
| `sessions`            | User sessions (Better Auth)                                            |
| `accounts`            | OAuth accounts (Better Auth)                                           |
| `verifications`       | Email OTP codes (Better Auth)                                          |
| `channels`            | Publishing destinations (YouTube, etc.) — one or more per user         |
| `video_jobs`          | Generation job records — status, pipeline stage, artifacts, output URL |
| `provider_api_keys`   | Per-provider AI API keys with cooldown / failure tracking              |
| `stored_files`        | R2 file references (metadata + public URL)                             |
| `credit_transactions` | Credit usage + purchase history                                        |
| `usage_idempotency`   | Prevents duplicate credit charges on queue retries                     |
| `site_settings`       | Admin-configurable toggles (e.g. registration enabled)                 |

Schema: `src/db/schema/`
Migrations: `drizzle/` (auto-generated — always commit)

---

## Video Pipeline

```
User idea
    │
    ▼
content-pipeline-execute.server.ts
    ├── Check credits + idempotency
    ├── Create video_job row (status=queued)
    └── Return jobId (dispatch is async via cron)
         │
         ▼ (every ~1 min)
    POST /api/cron/dispatch-queued-jobs
         │
         ▼
    process-content-pipeline.server.ts
         ├── CAS: queued → dispatched
         └── dispatchContentJob → POST spec to processor
              │
              ▼
         External Video Processor (:8790)
              ├── Stage 1: Script (Gemini → OpenRouter fallback)
              ├── Stage 2: Prepare (images + TTS + sound)
              ├── Stage 3: Assemble (FFmpeg encode)
              └── Stage 4: Upload (output.mp4 → R2 presigned PUT)
                   │
                   ▼
              POST /api/internal/video-processor/assembly-complete
                   │
                   ▼
         video-assembly-processor-webhook.server.ts
              ├── Mark job completed (outputUrl, scriptText, title, etc.)
              └── Trigger publish (if auto-post enabled)
```

### Pipeline Kinds

| Kind                  | Description                                       |
| --------------------- | ------------------------------------------------- |
| `content_pipeline_v1` | Full pipeline: script → assets → encode → publish |
| `stub_pipeline_v1`    | Stub jobs for testing/demos (no encode)           |
| `publish_only_v1`     | Re-publish an existing output URL                 |

### Job Statuses

`queued` → `dispatched` → `processing` → `completed` / `failed`

Failed jobs can be retried up to 3 times from the dashboard.

---

## AI Providers

All AI provider credentials live in `provider_api_keys` DB table, not hardcoded. Env vars are materialized into the table automatically on first use when no DB rows exist for that provider.

**Cooldown system:** failed keys enter cooldown with exponential backoff. Active keys (no cooldown) are preferred; if all keys are cooled down, all keys are tried anyway.

| Provider        | Usage                      | Fallback        |
| --------------- | -------------------------- | --------------- |
| `gemini`        | Script generation (LLM)    | `openrouter`    |
| `openrouter`    | Script generation fallback | —               |
| `google_tts`    | Text-to-Speech             | `unreal_speech` |
| `unreal_speech` | TTS fallback               | `elevenlabs`    |
| `elevenlabs`    | Sound effects              | —               |
| `replicate`     | Image generation (FLUX)    | —               |

Keys can be pinned to specific pipeline tasks via `taskType` (`any` / `script` / `tts` / `images`).

---

## Billing & Subscription Tiers

Billing via **Polar** — subscriptions + credit-based usage metering.

| Tier    | Key limits                                              |
| ------- | ------------------------------------------------------- |
| Free    | Limited videos/month, no sound effects, no auto-publish |
| Starter | More videos, basic publishing                           |
| Creator | Higher limits, sound effects, full publishing           |
| Empire  | Max limits, all features                                |

**Credits:** Each generation stage costs credits deducted at job creation. One-time credit packs (1k / 3k) available as add-ons. Usage is reported to Polar's usage meter (`klipse.usage`) after each job.

**Publishing destinations:** Paid tiers can connect multiple publishing channels. Destination replacement quota limits how many times a free user can swap their connected channel.

---

## Authentication

Better Auth with:

- **Email OTP** — passwordless sign-in (6-digit code, 10-minute expiry)
- **Google OAuth** — social sign-in
- **Admin plugin** — RBAC with `user` and `admin` roles; emails in `ADMIN_EMAILS` auto-promoted on login

**Registration kill switch:** Set `REGISTRATION_ENABLED=false` (env) or toggle in admin dashboard → blocks new user creation before any external calls (Polar customer creation only happens after user row is committed).

**Local development:** OTP is hardcoded to `123456` when `ENVIRONMENT=local` or `development`.

---

## Observability

Structured JSON-line logger (`src/lib/logger.ts`):

```ts
import { logger } from "@/lib/logger";

logger.info("job_created", { jobId, userId, credits });
logger.warn("provider_key_cooldown_set", { keyId, provider, cooldownUntil });
logger.error("webhook_failed", { jobId, status, body });
```

**Log levels:**
| Level | When emitted |
|---|---|
| `error` | Always |
| `warn` | Always |
| `info` | When `KLIPSE_PERF_LOG=1` OR non-production environment |
| `debug` | Development only |

**Production (Cloudflare Workers):** Logger writes to `console.*` → CF Observability Logs → Axiom OTLP endpoint. Configure in `wrangler.jsonc`:

```jsonc
"observability": {
  "logs": {
    "enabled": true,
    "destinations": ["main-app-logs"]   // must match CF dashboard destination name
  }
},
"vars": {
  "KLIPSE_PERF_LOG": "1"   // enable info-level logs
}
```

Then in CF dashboard → Workers → Observability → Destinations → add `main-app-logs` pointing to `https://api.axiom.co/v1/logs` with `Authorization: Bearer <token>` and `X-Axiom-Dataset: <dataset>` headers.

---

## Deployment

### Cloudflare Workers (main app)

```bash
pnpm deploy
# Equivalent to: vite build && wrangler deploy
```

Secrets (non-`vars` env vars) must be set via Wrangler CLI or CF dashboard:

```bash
wrangler secret put DATABASE_URL
wrangler secret put BETTER_AUTH_SECRET
# ... etc
```

### Video Processor (GCP Cloud Run)

Build and push the Docker image, then deploy to Cloud Run. Set `VIDEO_PROCESSOR_URL` in the main app to the Cloud Run service URL.

```bash
pnpm processor:docker:build
docker tag klipse-external-video-processor:latest gcr.io/<project>/<image>
docker push gcr.io/<project>/<image>
```

### Database Migrations

Migrations run automatically as part of `pnpm build` (`prebuild` script). For manual apply:

```bash
pnpm db:migrate
```

---

## Code Conventions

- **Linting/Formatting:** Biome — run `pnpm check` before committing
- **TypeScript:** Strict mode; path alias `@/*` → `src/*`
- **Server-only code:** Files suffixed `.server.ts` contain server-side logic — never import into client components
- **Server functions:** Use TanStack Start `createServerFn` for type-safe server calls from client
- **IDs:** UUIDv7 via `src/lib/id.ts` — use the typed generators (`userId()`, `jobId()`, etc.)
- **Validation:** Zod throughout; T3Env for env vars
- **Logging:** `logger.*` (never `console.*` directly in app code)
- **Toasts:** Sonner (`sonner` package)
- **React:** React 19 with Babel React Compiler plugin enabled
- **Commits:** Biome check must pass; no `--no-verify`

---

## Deep-Dive Docs

| Doc                                                | Contents                                                                 |
| -------------------------------------------------- | ------------------------------------------------------------------------ |
| [docs/ai-providers.md](docs/ai-providers.md)       | Key pool, cooldown/rotation system, task pinning, failure classification |
| [docs/billing.md](docs/billing.md)                 | Polar setup, credit costs, tier limits, customer lifecycle               |
| [docs/video-pipeline.md](docs/video-pipeline.md)   | Full pipeline flow, processor spec format, webhook payloads, idempotency |
| [docs/video-processor.md](docs/video-processor.md) | Processor endpoints, pipeline stages, script format, callbacks, env vars |
| [docs/deployment.md](docs/deployment.md)           | CF Workers deploy, GCP Cloud Run, secrets, DB migration, cron setup      |
| [docs/observability.md](docs/observability.md)     | Logger, log levels, CF Logpush → Axiom, Sentry, key log events reference |
