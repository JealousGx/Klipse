# Klipse — CLAUDE.md

## Project Overview

Klipse is an AI-powered video creation and publishing SaaS. Users submit a text idea; the system generates a full short-form video (AI script, images, TTS narration, optional sound, FFmpeg encode) and publishes to YouTube automatically or on approval.

**Key facts:**
- All asset generation (images, TTS, sound) happens **inside the external processor** in local `/tmp/` — never uploaded to R2 as intermediates
- Only the final `output.mp4` is written to R2
- Job dispatch via **cron polling** (`/api/cron/dispatch-queued-jobs` every ~1 min) — no CF Queue, no separate CF Worker
- `klipse-worker` package is **obsolete and removed** — no `workers/` directory
- AI provider keys stored in DB (`provider_api_keys` table) with cooldown/rotation tracking — env vars are fallback only (materialized into DB on first use)
- Registration can be killed via env var (`REGISTRATION_ENABLED=false`) or DB toggle — Polar customer is created in `after` hook (not `before`) to prevent orphaned customers when registration is blocked

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | TanStack Start (React 19 + Vite 7) |
| Routing | TanStack Router (file-based) |
| State / Data | TanStack Query + TanStack Store |
| Styling | Tailwind CSS 4 + Shadcn UI + Radix UI |
| Database | MySQL (TiDB serverless in prod) + Drizzle ORM |
| Auth | Better Auth (Email OTP + Google OAuth + Polar plugin) |
| Storage | Cloudflare R2 — final video only |
| AI — Script | Gemini 2.5 Flash (primary) → OpenRouter (fallback) |
| AI — Images | Replicate SDXL (processor-side, local `/tmp/`) |
| AI — TTS | Google Cloud TTS (primary) → Unreal Speech → ElevenLabs |
| AI — Sound | ElevenLabs (Creator+ only, processor-side) |
| Job Dispatch | Cron polling — `/api/cron/dispatch-queued-jobs` ~1 min |
| Video Encoding | External Hono/Node service — `packages/external-video-processor/` |
| Billing | Polar (subscriptions + credit-based usage metering) |
| Email | Resend |
| Error Tracking | Sentry (server + client) |
| Observability | Structured JSON logger → CF Observability Logs → Axiom OTLP |
| Linting/Fmt | Biome 2.x |
| Package Mgr | pnpm 10 (monorepo) |
| Node | >=23.0.0 |

---

## Architecture

Two runtime services:

```
┌─────────────────────────────────────┐
│  Main App (TanStack Start / CF)     │  :3000 (dev) / klipse.app (prod)
│  src/ — SSR React + server fns      │
│  MySQL ← Drizzle ORM                │
│  Cloudflare R2 (final video only)   │
│  Cron: dispatch-queued-jobs ~1/min  │
└──────────────┬──────────────────────┘
               │ POST /v1/process-spec
               ▼
┌─────────────────────────────────────┐
│  External Video Processor           │  :8790 (dev) / GCP Cloud Run (prod)
│  packages/external-video-processor/ │
│  Hono + FFmpeg                      │
│  Script → Images + TTS + Sound      │
│  → FFmpeg encode → R2 PUT           │
│  → POST callback to main app        │
└─────────────────────────────────────┘
```

**Video pipeline flow:**
1. User submits idea → `content-pipeline-execute.server.ts`
   - Idempotency check (`usage_idempotency` table)
   - Credit balance check + deduction
   - Create `video_jobs` row (`status=queued`)
   - Report usage to Polar meter
2. Cron fires → `dispatch-queued-jobs.server.ts` picks up queued jobs (max 10/tick)
3. CAS update: `queued → dispatched`; `buildProcessorJobSpec` constructs full spec
4. `POST /v1/process-spec` to processor with `ProcessorJobSpec`
5. Processor runs stages:
   - **Script:** Gemini → OpenRouter fallback chain → JSON `{ voiceover, imagePrompts[], title, description, tags }`
   - **Prepare:** SDXL images (sequential, Replicate burst=1) + Google TTS (concurrent) + ElevenLabs sound (optional, Creator+) — all to local `/tmp/`
   - **Assemble:** FFmpeg encode → watermark (free tier) → presigned PUT to R2
6. Processor POSTs complete callback → `assembly-complete` webhook
7. Main app: marks job `completed`, saves artifacts (`scriptText`, `title`, `description`, `tags`), triggers YouTube publish

**Stuck-dispatch recovery:** Cron re-dispatches if job stuck in `dispatched` + `stage=dispatch_pending` > 3 min.

---

## Development Setup

### Prerequisites
- Node.js >= 23.0.0
- pnpm 10.x (`corepack enable`)
- Docker (MySQL + processor)

### Steps

```bash
# 1. Install
pnpm install

# 2. Copy env
cp .env.example .env.local
# Minimum: DATABASE_URL, BETTER_AUTH_SECRET, SERVER_URL, APP_PUBLIC_URL

# 3. Start MySQL
pnpm db:setup

# 4. Run migrations
pnpm db:migrate

# 5. Start main app (:3000)
pnpm dev

# 6. (Optional) Start video processor (:8790)
pnpm processor:docker:up
pnpm processor:docker:logs
```

**Local OTP:** hardcoded to `123456` when `ENVIRONMENT=local` or `development`.

**Docker → host networking:** set `APP_PUBLIC_URL=http://host.docker.internal:3000` so processor callbacks reach main app.

---

## Key Scripts

### Main App
```bash
pnpm dev                  # Dev server on :3000
pnpm build                # Production build (runs db:migrate first via prebuild)
pnpm deploy               # build + wrangler deploy to Cloudflare
pnpm preview              # Preview production build
pnpm test                 # Vitest
pnpm check                # Biome check (lint + format)
pnpm lint                 # Biome lint
pnpm format               # Biome format
```

### Database
```bash
pnpm db:setup             # Docker Compose MySQL (wipes + restarts)
pnpm db:generate          # Generate migration files from schema changes
pnpm db:migrate           # Apply pending migrations
pnpm db:push              # Push schema directly (dev shortcut, no migration file)
pnpm db:studio            # Drizzle Studio GUI
```

### Video Processor
```bash
pnpm processor:docker:up      # Build + start container (:8790)
pnpm processor:docker:down    # Stop container
pnpm processor:docker:logs    # Stream logs
pnpm processor:docker:setup   # Down + up (full restart)
pnpm processor:typecheck      # Type-check processor package
```

---

## Project Structure

```
klipse/
├── src/
│   ├── routes/
│   │   ├── __root.tsx              # Root layout
│   │   ├── index.tsx               # Landing page
│   │   ├── dashboard/              # Authenticated app pages
│   │   │   ├── index.tsx           # Dashboard home
│   │   │   ├── generate.tsx        # Video generation UI
│   │   │   ├── jobs.tsx            # Job history
│   │   │   ├── publishing.tsx      # Publishing destinations
│   │   │   ├── analytics.tsx
│   │   │   ├── billing.tsx
│   │   │   └── settings.tsx
│   │   └── api/
│   │       ├── auth/$              # Better Auth endpoints
│   │       ├── youtube/oauth/*     # YouTube OAuth flow
│   │       ├── internal/
│   │       │   ├── processor/      # Processor → app callbacks (progress, key-failure)
│   │       │   └── video-processor/ # assembly-complete webhook
│   │       └── cron/               # Scheduled tasks
│   │           ├── dispatch-queued-jobs.ts
│   │           ├── purge-expiring-assets.ts
│   │           └── trigger-scheduled-jobs.ts
│   ├── features/
│   │   ├── ai/
│   │   │   ├── lib/                # Provider key pool, rotation, cooldown, fingerprint
│   │   │   ├── config/             # Model routing / chain config
│   │   │   └── prompts/            # Script + voice prompts
│   │   ├── auth/                   # Auth UI + session helpers
│   │   ├── billing/                # Polar plugin, credit costs, tier config, metering
│   │   ├── channels/               # Channel management + destination quota
│   │   ├── entitlements/           # Plan gates (sound, publishing, duration clamp)
│   │   ├── publishing/             # Platform-specific publish dispatch
│   │   ├── user/                   # User profile
│   │   ├── video/
│   │   │   └── pipeline/           # Pipeline stages (dispatch, content, stub, webhook)
│   │   └── youtube/                # OAuth tokens + reconcile + upload API
│   ├── db/
│   │   ├── index.ts                # DB singleton
│   │   └── schema/                 # Drizzle table definitions
│   ├── lib/
│   │   ├── auth/                   # Better Auth instance + RBAC (ac, adminRoles)
│   │   ├── storage/                # R2 helpers + presigned URLs
│   │   ├── email/                  # Resend / OTP emails
│   │   ├── logger.ts               # Structured JSON logger (see Logging section)
│   │   ├── sentry.ts               # Sentry captureException helper
│   │   ├── id.ts                   # UUIDv7 typed ID generators
│   │   └── perf-timing.ts          # withPerfTiming wrapper
│   ├── components/                 # Reusable UI components
│   ├── config/site.ts              # Site metadata (name, URLs)
│   └── env.ts                      # T3Env + Zod env schema
├── packages/
│   ├── video-assembly-shared/      # Shared types: ProcessorJobSpec, callbacks, etc.
│   └── external-video-processor/   # FFmpeg encoding service (Hono/Node)
│       └── src/
│           ├── index.ts            # Hono server — /health, /v1/process, /v1/process-spec
│           ├── pipeline/
│           │   ├── executor.ts     # executeJob — orchestrates all stages
│           │   ├── stages/
│           │   │   ├── script.ts   # Stage 1: LLM script gen + JSON parse
│           │   │   ├── prepare.ts  # Stage 2: images + TTS + sound → /tmp/
│           │   │   └── assemble.ts # Stage 3: FFmpeg + watermark + R2 upload
│           │   └── runner.ts       # Job queue (in-memory, dedup)
│           ├── providers/          # script-gen, image-gen, tts-gen, sound-gen
│           ├── utils/
│           │   ├── callbacks.ts    # reportProgress, reportKeyFailure, reportComplete
│           │   ├── logger.ts       # Processor structured logger (direct Axiom drain)
│           │   └── retry.ts        # withRetries helper
│           └── ffmpeg/             # concat, mux, probe, segment helpers
├── docker/
│   └── external-video-processor/   # Dockerfile + docker-compose.yml
├── drizzle/                         # Generated migration files (commit these)
├── wrangler.jsonc                   # CF Worker config (observability, routes, vars)
├── .env.example                     # Env template
├── drizzle.config.ts                # Drizzle ORM config
├── vite.config.ts                   # Build config
└── biome.json                       # Lint/format config
```

---

## Database

**Engine:** MySQL 8 (local Docker Compose, prod TiDB Cloud serverless)

| Table | Purpose |
|---|---|
| `users` | Accounts — plan, credit balance |
| `sessions` | Better Auth sessions |
| `accounts` | OAuth accounts (Better Auth) |
| `verifications` | Email OTP codes |
| `channels` | Publishing destinations (YouTube, etc.) |
| `video_jobs` | Job records — status, stage, artifacts, outputUrl |
| `provider_api_keys` | AI provider keys with cooldown/failure state |
| `stored_files` | R2 file metadata + public URL |
| `credit_transactions` | Credit deduction + purchase history |
| `usage_idempotency` | Prevents duplicate credit charges on queue retry |
| `site_settings` | Admin toggles (e.g. `registration_enabled`) |

Schema: `src/db/schema/`  
Migrations: `drizzle/` — auto-generated, always commit.

### video_jobs key columns
- `status`: `queued → dispatched → processing → completed / failed`
- `currentStage`: `dispatch_pending | script | prepare | assemble | upload | done`
- `artifacts`: JSON — `{ scriptText?, title?, description?, tags[] }` (populated by processor via complete callback)
- `pipelineKind`: `content_pipeline_v1 | stub_pipeline_v1 | publish_only_v1`
- `retryCount`: manual retries from dashboard, capped at 3

---

## Environment Variables

See `.env.example` for full list. Key variables:

### Core
```
DATABASE_URL              MySQL connection string
BETTER_AUTH_SECRET        Random secret (npx -y @better-auth/cli secret)
BETTER_AUTH_URL           http://localhost:3000
SERVER_URL                http://localhost:3000
APP_PUBLIC_URL            http://host.docker.internal:3000 (processor → host)
ENVIRONMENT               local | development | staging | production
INTERNAL_CRON_SECRET      Bearer token for /api/cron/* endpoints
```

### Google OAuth + YouTube
```
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
YOUTUBE_OAUTH_STATE_SECRET   # CSRF state token (openssl rand -hex 32)
```

### Storage (R2)
```
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
R2_PUBLIC_BASE_URL
```

### Video Processor
```
VIDEO_PROCESSOR_URL              http://localhost:8790
VIDEO_PROCESSOR_CLIENT_SECRET    # app → processor (openssl rand -hex 32)
VIDEO_PROCESSOR_WEBHOOK_SECRET   # processor → app (openssl rand -hex 32)
```

### AI Providers (comma-separated keys; materialized into DB on first use)
```
GEMINI_API_KEYS
GEMINI_SCRIPT_MODEL        # default: gemini-2.5-flash
OPENROUTER_API_KEYS
GOOGLE_TTS_API_KEYS
GOOGLE_TTS_VOICE_NAME      # default: en-US-Wavenet-G
UNREAL_SPEECH_API_KEYS
ELEVENLABS_API_KEYS
REPLICATE_API_KEYS
```

### Billing (Polar)
```
POLAR_ACCESS_TOKEN
POLAR_WEBHOOK_SECRET       # webhook URL: /api/auth/polar/webhooks
POLAR_SERVER               # sandbox | production
POLAR_PRODUCT_STARTER
POLAR_PRODUCT_CREATOR
POLAR_PRODUCT_EMPIRE
POLAR_PRODUCT_CREDITS      # 1k credit pack
POLAR_PRODUCT_CREDITS_LARGE # 3k credit pack
```
Usage meter: name=`klipse.usage`, aggregation=**Sum**, metadata key=`credits`.

### Email
```
RESEND_API_KEY
EMAIL_FROM
```

### Observability
```
KLIPSE_PERF_LOG=1          # Enable info-level logs in production (add to wrangler.jsonc vars)
AXIOM_API_TOKEN            # Direct Axiom drain (processor only; main app uses CF Logpush)
AXIOM_DATASET              # default: klipse
SENTRY_DSN                 # Server Sentry
VITE_APP_SENTRY_DSN        # Client Sentry
SENTRY_AUTH_TOKEN          # Source map upload
```

### Feature Flags
```
REGISTRATION_ENABLED=true        # Server-side kill switch
VITE_REGISTRATION_ENABLED=true   # Client-side UI toggle
```

### Client / UI
```
VITE_APP_TITLE
VITE_APP_URL               # Canonical URL for SEO/OG
VITE_APP_SUPPORT_EMAIL
VITE_APP_DISCORD_URL
VITE_APP_FEATURE_BASE_URL
DISCORD_BUG_REPORT_WEBHOOK_URL
ADMIN_EMAILS               # Comma-separated — auto-promoted to admin on login
```

---

## AI Provider Key System

Keys in `provider_api_keys` table. Env vars materialized into DB on first use (when row count = 0 for that provider). After that, env changes are ignored — update DB rows directly.

**Providers:** `openrouter | gemini | google_tts | replicate | unreal_speech | elevenlabs`

**Key selection:** Active keys first (`cooldownUntil IS NULL OR < NOW()`). If all cooled down, try all anyway.

**Rotation:** `executeWithProviderKeyRotation` — tries each key with exponential backoff (`min(100ms × 2^i, 8000ms)`). On classifiable HTTP error: records cooldown, tries next key.

**Cooldown types:**
- Short: 429 (90s), 503/408 (45s), 5xx (15s), 403 forbidden (2min)
- Long (quota/auth): 401, 402, quota-exhausted 429/403 → until next UTC month or `Retry-After` header

**Task pinning:** `taskType` column (`any | script | tts | images | sound`) — pin keys to specific pipeline stages.

**Per-key model override:** `model_id` column — key uses this model instead of global default.

---

## Billing & Credits

| Tier | Monthly Credits | Channels | Sound | Publishing |
|---|---|---|---|---|
| Free | — | 1 | ❌ | ❌ |
| Starter | 1,500 | 1 | ❌ | ✅ |
| Creator | 5,000 | 3 | ✅ | ✅ |
| Empire | 15,000 | 20 | ✅ | ✅ |

**Credit costs:**
- Script generation: 5
- Image (per image): 2
- TTS (per 1k chars): 4
- Video assembly: 3
- AI video (per second): 3

Credits deducted at **job creation**, not completion. Polar meter receives `{ event: "klipse.usage", metadata: { credits: N } }` per job.

**Credit add-ons:** Small (750 credits), Large (2,000 credits) one-time packs.

**Destination replacements per billing cycle:** Free=0, Starter=1, Creator=5, Empire=30.

---

## Authentication

Better Auth with:
- **Email OTP** — 6-digit code, 10-min expiry, 5 attempts max
- **Google OAuth** — social sign-in
- **Admin plugin** — RBAC, `user` (default) and `admin` roles; `ADMIN_EMAILS` auto-promotes on login

**Registration kill switch:** Two independent gates checked in `databaseHooks.user.create.before`:
1. `REGISTRATION_ENABLED=false` env var (hard block)
2. `site_settings.registration_enabled = false` (admin toggle)

**Polar customer creation:** Uses `databaseHooks.user.create.after` (NOT `before`) so Polar API is never called if registration is blocked. Creates or links existing Polar customer by email, sets `externalId = user.id`.

---

## Logging

Structured JSON-line logger: `src/lib/logger.ts` (main app), `packages/external-video-processor/src/utils/logger.ts` (processor).

```ts
import { logger } from "@/lib/logger";
logger.info("job_created", { jobId, userId, credits });
logger.warn("provider_key_cooldown_set", { keyId, provider, cooldownUntil });
logger.error("webhook_failed", { jobId, status: 500 });
```

**Never use `console.*` directly in app code** — always `logger.*`.

**Log levels:**
- `error` / `warn` → always emitted
- `info` → when `KLIPSE_PERF_LOG=1` OR non-production
- `debug` → development only

**Production delivery:** Logger calls `console.*` → CF Observability Logs → Axiom OTLP destination (`main-app-logs`). Configured in `wrangler.jsonc` + CF dashboard destination pointing to `https://api.axiom.co/v1/logs`.

**Processor:** Direct Axiom HTTP drain (fire-and-forget fetch — safe on Node.js/Cloud Run, not safe on CF Workers). Service field: `"service": "klipse-processor"`.

**`LogContext.status`** is typed as `number` (HTTP code). Use `jobStatus` (not `status`) for string job statuses to avoid type conflict.

---

## Code Conventions

- **Linting/Formatting:** Biome — `pnpm check` before committing. No `--no-verify`.
- **TypeScript:** Strict mode; path alias `@/*` → `src/*`
- **Server-only code:** Files suffixed `.server.ts` — never import into client components
- **Server functions:** `createServerFn` for type-safe server → client calls
- **IDs:** UUIDv7 via `src/lib/id.ts` — use typed generators (`userId()`, `jobId()`, etc.)
- **Validation:** Zod throughout; T3Env for env vars
- **Logging:** `logger.*` only (never `console.*`)
- **Toasts:** Sonner (`sonner` package)
- **React:** React 19 with Babel React Compiler enabled
- **Imports:** Biome auto-sorts — run `pnpm check --write` after adding imports

---

## Deployment

**Main app:** `pnpm deploy` → `vite build && wrangler deploy`

Key `wrangler.jsonc` config:
```jsonc
"observability": {
  "logs": { "enabled": true, "destinations": ["main-app-logs"] },
  "traces": { "enabled": true, "destinations": ["main-app-traces"] }
},
"vars": {
  "ENVIRONMENT": "production",
  "KLIPSE_PERF_LOG": "1"
}
```
All secrets via `wrangler secret put <NAME>` (not in `vars`).

**Video processor:** Docker image → GCP Cloud Run. Memory: 2Gi+, timeout: 900s, concurrency: 1.

**Database:** `pnpm db:migrate` (runs automatically in `prebuild`).

**Cron jobs** (`INTERNAL_CRON_SECRET` required):
- `POST /api/cron/dispatch-queued-jobs` — every ~1 min
- `POST /api/cron/purge-expiring-assets` — daily
- `POST /api/cron/trigger-scheduled-jobs` — per schedule

---

## Testing

```bash
pnpm test    # Vitest + React Testing Library + JSDOM
```

Tests alongside source files or in `__tests__/` directories.
