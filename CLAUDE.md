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
| AI — Script | Gemini 2.5 Flash (primary) → OpenRouter (fallback) — produces an array of `video_prompts`, one per ~5s segment, not a spoken script |
| AI — Video+Audio | Self-hosted LTX-2.3 — segmented generation (~5s/121-frame independent calls, start-frame conditioned, concatenated) w/ native audio |
| Job Dispatch | Cron polling — `/api/cron/dispatch-queued-jobs` ~1 min |
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
               │ Cloud Run Admin API: jobs.run
               ▼
┌─────────────────────────────────────┐
│  External Video Processor           │  GCP Cloud Run Job (GPU) — triggered
│  processor/                          │  on-demand via jobs.run, no HTTP
│  Python + self-hosted LTX-2.3        │  server, no port — one execution
│  + ffmpeg (concat + watermark)      │  processes one job then exits
│  Fetches own spec (GET) → script →  │
│  segmented video+audio gen → concat │
│  → watermark (free tier) → R2       │
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
3. CAS update: `queued → dispatched`; app triggers a Cloud Run **Job** execution via the Cloud Run Admin API (`jobs.run`, JWT-bearer OAuth2 auth), passing `KLIPSE_JOB_ID` as a per-execution container override — no direct HTTP call to the processor, no `VIDEO_PROCESSOR_URL`
4. Processor's `job_main.py` fetches its own full spec via `GET /api/internal/processor/job-spec?jobId=...`, then runs the job
5. Processor runs stages:
   - **Script:** Gemini → OpenRouter fallback chain → JSON `{ video_prompts: string[], title, description, tags }` — an *array* of LTX-2.3-prompt-guide-structured prompts, one per ~5s segment, describing a continuous multi-scene story (narration/dialogue/audio woven into each); there is no separate voiceover/TTS text
   - **Video gen:** each `video_prompts` entry is generated as its own independent ~5s call (121 frames @ 24fps, the real official per-call default — a single un-segmented ~30s call reliably OOMs on a 96GB GPU), then concatenated via ffmpeg. Continuity across segments comes from two things: LLM-authored prompt consistency, and real start-frame conditioning (each segment after the first is anchored to the actual last frame of the one before it, via `DistilledPipeline`'s own `images` conditioning parameter) → watermark (free tier only, ffmpeg `drawtext`) → presigned PUT to R2
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

# 6. (Optional) Run video processor against a local job (needs a CUDA GPU for real
# generation — otherwise useful for API/plumbing testing only; one execution processes
# one job then exits, no long-lived server/port)
cp processor/.env.example processor/.env
pnpm processor:docker:build
docker compose -f processor/docker-compose.yml \
  run --rm -e KLIPSE_JOB_ID=<job-id-from-your-local-db> external-video-processor
```

**Local OTP:** hardcoded to `123456` when `ENVIRONMENT=local` or `development`.

**Docker → host networking:** set `KLIPSE_APP_BASE_URL=http://host.docker.internal:3000` in `processor/.env` so processor callbacks reach main app.

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
pnpm processor:docker:build   # Build image (bakes in ~67GB weights from Hugging Face)
docker compose -f processor/docker-compose.yml \
  run --rm -e KLIPSE_JOB_ID=<job-id> external-video-processor   # Run one job, then exits
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
│   └── video-assembly-shared/      # Shared types: ProcessorJobSpec, callbacks, etc.
├── processor/                       # Python video processor — Cloud Run Job (GPU)
│   ├── Dockerfile                   # CUDA image, weights baked in via HF download
│   ├── cloudbuild.yaml              # Build + push + `gcloud run jobs deploy`
│   ├── requirements.txt             # Pinned ltx-core/ltx-pipelines commit, sageattention
│   ├── terraform/                   # Job, service accounts, IAM, Artifact Registry repo
│   └── src/
│       ├── job_main.py              # Entrypoint — fetches own spec via GET, runs job
│       ├── job.py                   # Job orchestration
│       ├── script_gen.py            # LLM script gen (Gemini → OpenRouter) + JSON parse
│       ├── inference/
│       │   ├── model.py             # DistilledPipeline load (fp8, SageAttention, warmup)
│       │   └── generate.py          # Segmented generation + start-frame conditioning + concat
│       ├── watermark.py             # ffmpeg drawtext (free tier)
│       ├── r2_upload.py             # Presigned PUT to R2
│       ├── callbacks.py             # reportProgress, reportKeyFailure, reportComplete
│       ├── logger.py                # Structured logger (direct Axiom drain)
│       └── retry.py                 # withRetries helper
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
VIDEO_PROCESSOR_WEBHOOK_SECRET     # processor → app callbacks (openssl rand -hex 32)
VIDEO_PROCESSOR_CALLBACK_URL       # optional override, local dev via tunnel only
GCP_PROJECT_ID                     # project the processor Job is deployed in
GCP_RUN_REGION                     # default: us-central1
GCP_RUN_JOB_NAME                   # Cloud Run Job resource name
GCP_SERVICE_ACCOUNT_EMAIL          # mints OAuth token for Cloud Run Admin API (jobs.run)
GCP_SERVICE_ACCOUNT_PRIVATE_KEY    # PEM RSA key, JWT-bearer assertion signing
```

### AI Providers (comma-separated keys; materialized into DB on first use)
```
GEMINI_API_KEYS            # model not env-configurable — hardcoded in processor/src/script_gen.py, per-key override via DB model_id
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
- AI video (per second): 3

(Image/TTS/video-assembly line items are retired — the self-hosted model generates video+audio in one call.)

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

Structured JSON-line logger: `src/lib/logger.ts` (main app), `processor/src/logger.py` (processor).

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

**Processor:** Direct Axiom HTTP drain (fire-and-forget request — Cloud Run Job, not a CF Worker, so no fetch-lifetime restriction). Service field: `"service": "klipse-processor"`.

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

**Video processor:** Python Docker image → GCP Cloud Run Job **with GPU** (self-hosted LTX-2.3). Model weights **are baked into the image** — downloaded directly from Hugging Face inside `processor/Dockerfile` as an early, cacheable layer, not mounted from GCS at runtime (a GCS-mount approach was tried and abandoned: a real deploy confirmed the mount satisfied weight reads lazily/on-demand, causing a ~30min stall on every job's first forward pass). GPU tier confirmed as **RTX Pro 6000 (96GB)** — LTX-2.3 requires 32GB+ VRAM and 100GB+ disk, which rules out Cloud Run's cheaper L4 (24GB) tier. GPU/timeout/concurrency/scale-to-zero/cost-guardrails are managed via Terraform (`processor/terraform/`) — see `docs/deployment.md` for confirmed working values (Phase 0's standalone GPU validation was skipped by explicit decision; production traffic is the first real test).

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
