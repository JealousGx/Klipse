# Klipse — CLAUDE.md

## Project Overview

Klipse is an AI-powered video creation and publishing SaaS platform. It automates the full pipeline from user idea → AI script → media assets (images, TTS audio) → video encoding → multi-platform publishing (YouTube, TikTok, etc.).

Key capabilities:
- Multi-stage video generation pipeline (stub, content, publish-only)
- Multiple AI providers for script/image/audio/video generation (OpenAI, Gemini, Pollinations, Luma, Kling)
- Subscription tiers (Free, Starter, Creator, Empire) with a credit-based billing system via Polar
- YouTube OAuth publishing with auto-post or approval-pending modes
- Cloudflare R2 for asset storage, Cloudflare Workers for async job processing
- External FFmpeg-based video encoding service (Docker)

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
| Storage | Cloudflare R2 (S3-compatible) |
| AI — Script | OpenAI, Google Gemini, Pollinations (fallback chain) |
| AI — Media | Pollinations, Luma AI, Kling AI |
| TTS | Google Text-to-Speech |
| Queue | Cloudflare Workers + Cloudflare Queues |
| Video Encoding | External Hono/Node service (Docker, FFmpeg) |
| Billing | Polar (subscriptions + usage metering) |
| Email | Resend |
| Linting/Fmt | Biome 2.x |
| Package Mgr | pnpm 10 (monorepo) |
| Node | >=23.0.0 required |

---

## Architecture

The project is a **pnpm monorepo** with three runtime services:

```
┌─────────────────────────────────┐
│  Main App (TanStack Start)      │  :3000
│  src/ — SSR React + server fns  │
│  MySQL ← Drizzle ORM            │
│  Cloudflare R2 (uploads)        │
└────────────┬────────────────────┘
             │ enqueue via HTTP
             ▼
┌─────────────────────────────────┐
│  Cloudflare Worker              │  :8787 (local)
│  workers/klipse-worker/         │
│  Consumes queue → calls main    │
└─────────────────────────────────┘

             ┌─────────────────────────────────┐
             │  External Video Processor       │  :8790
             │  packages/external-video-       │
             │  processor/ (Hono + FFmpeg)     │
             │  Docker container               │
             └─────────────────────────────────┘
```

**Video pipeline flow:**
1. User submits idea → `content-pipeline-execute.server.ts`
2. Prepare stage — fetch/generate images, TTS audio, upload to R2
3. Script stage — AI script generation (OpenAI → Gemini → Pollinations fallback)
4. Handoff — main app sends assembly manifest to external processor
5. Processor encodes video (FFmpeg), uploads final file to R2, calls webhook back
6. Webhook handler marks job complete, triggers publishing if auto-post enabled

**Shared packages:**
- `@klipse/worker-contracts` — queue message type contracts
- `@klipse/video-assembly-shared` — shared types between main app and processor

---

## Development Setup

### Prerequisites
- Node.js >= 23
- pnpm 10.x (`corepack enable`)
- Docker (for MySQL and video processor)

### Steps

```bash
# 1. Install dependencies
pnpm install

# 2. Copy and fill env
cp .env.example .env.local
# Edit .env.local — minimum required: DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL, SERVER_URL

# 3. Start MySQL
pnpm db:setup

# 4. Run migrations
pnpm db:migrate

# 5. Start the main app
pnpm dev

# 6. (Optional) Start the Cloudflare Worker queue consumer
cp workers/klipse-worker/.dev.vars.example workers/klipse-worker/.dev.vars
# Edit .dev.vars with the same WORKER_SECRET as in .env.local
pnpm worker:dev

# 7. (Optional) Start the external video processor
pnpm processor:docker:up
```

---

## Key Scripts

### Main App
```bash
pnpm dev                  # Dev server on :3000
pnpm build                # Production build
pnpm preview              # Preview production build
pnpm test                 # Run Vitest tests
pnpm lint                 # Biome lint
pnpm format               # Biome format
pnpm check                # Biome check (lint + format)
```

### Database
```bash
pnpm db:setup             # Docker Compose MySQL (wipes and restarts)
pnpm db:generate          # Generate migration files from schema
pnpm db:migrate           # Apply migrations
pnpm db:push              # Push schema directly (dev shortcut)
pnpm db:studio            # Drizzle Studio GUI
```

### Worker
```bash
pnpm worker:dev           # Run worker locally via Wrangler (:8787)
pnpm worker:typecheck     # Type-check worker
```

### Video Processor (Docker)
```bash
pnpm processor:docker:up    # Build and start processor container
pnpm processor:docker:down  # Stop processor container
pnpm processor:docker:logs  # Stream processor logs
pnpm processor:typecheck    # Type-check processor
```

---

## Project Structure

```
klipse/
├── src/
│   ├── routes/              # File-based routes (TanStack Router)
│   │   ├── __root.tsx       # Root layout
│   │   ├── index.tsx        # Landing page
│   │   ├── dashboard/       # Authenticated app pages
│   │   │   ├── index.tsx    # Dashboard home
│   │   │   ├── generate.tsx # Video generation UI
│   │   │   ├── jobs.tsx     # Job history
│   │   │   ├── publishing.tsx / publishing.$destinationId.tsx
│   │   │   ├── analytics.tsx
│   │   │   ├── billing.tsx
│   │   │   └── settings.tsx
│   │   └── api/             # Server API routes
│   │       ├── auth/$       # Better Auth endpoints
│   │       ├── youtube/oauth/*
│   │       ├── internal/worker/*   # Worker → app internal APIs
│   │       ├── internal/video-processor/*  # Processor webhook
│   │       └── cron/        # Scheduled cron tasks
│   ├── features/            # Feature modules
│   │   ├── ai/              # AI providers, script generation, prompts
│   │   ├── auth/            # Auth UI + session helpers
│   │   ├── billing/         # Polar, credits, tiers, metering
│   │   ├── channels/        # Publishing channel management
│   │   ├── entitlements/    # Access control, quota checks
│   │   ├── publishing-destination/  # Platform-specific publish UI
│   │   ├── user/            # User profile
│   │   ├── video/           # Video pipeline + job management
│   │   │   └── pipeline/    # Individual pipeline stages
│   │   └── youtube/         # YouTube OAuth + token management
│   ├── db/
│   │   ├── index.ts         # DB connection
│   │   └── schema/          # Drizzle table definitions
│   ├── lib/                 # Shared utilities
│   │   ├── auth/            # Better Auth instance + client
│   │   ├── storage/         # R2 helpers
│   │   ├── worker/          # Queue enqueue helpers
│   │   └── email/           # Resend / OTP emails
│   ├── components/          # Reusable UI components
│   ├── config/site.ts       # Site metadata
│   └── env.ts               # T3Env schema (type-safe env vars)
├── packages/
│   ├── worker-contracts/    # Queue message type contracts
│   ├── video-assembly-shared/  # Shared assembly types
│   └── external-video-processor/  # FFmpeg encoding service (Hono)
├── workers/
│   └── klipse-worker/       # Cloudflare Worker queue consumer
├── docker/
│   └── external-video-processor/  # Docker Compose for processor
├── drizzle/                 # Generated migration files
├── .env.example             # Environment variable template
├── drizzle.config.ts        # ORM config
├── vite.config.ts           # Build config
└── biome.json               # Lint/format config
```

---

## Database

**Engine:** MySQL (local via Docker Compose, production via TiDB Cloud serverless)

**Key tables:**
| Table | Purpose |
|---|---|
| `users` | Accounts, plan tier, credits |
| `channels` | Publishing destinations (YouTube, TikTok) |
| `video_jobs` | Generation job records + status |
| `accounts` | OAuth accounts (Better Auth) |
| `sessions` | User sessions (Better Auth) |
| `verifications` | Email OTP codes |
| `credit_transactions` | Credit usage history |
| `provider_api_keys` | Per-user AI provider API keys |
| `stored_files` | R2 file references |
| `usage_idempotency` | Prevents duplicate operations |

Schema files: `src/db/schema/`
ORM config: `drizzle.config.ts`
Migrations: `drizzle/` (auto-generated, commit these)

---

## Environment Variables

Copy `.env.example` → `.env.local`. Minimum required for local dev:

```
DATABASE_URL              MySQL connection string
BETTER_AUTH_SECRET        Random secret (generate via `npx @better-auth/cli secret`)
BETTER_AUTH_URL           http://localhost:3000
SERVER_URL                http://localhost:3000
WORKER_API_URL            http://127.0.0.1:8787
WORKER_SECRET             Shared secret between app and worker
```

Additional for full functionality:
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — Google OAuth + YouTube
- `YOUTUBE_OAUTH_STATE_SECRET` — CSRF protection for YouTube OAuth
- `R2_*` — Cloudflare R2 storage
- `VIDEO_PROCESSOR_URL` / `VIDEO_PROCESSOR_CLIENT_SECRET` / `VIDEO_PROCESSOR_WEBHOOK_SECRET` — encoder service
- `OPENAI_API_KEY` / `GEMINI_API_KEYS` / `POLLINATIONS_API_KEY` — AI providers
- `GOOGLE_TTS_API_KEYS` — Text-to-Speech
- `RESEND_API_KEY` / `EMAIL_FROM` — Email
- `POLAR_*` — Billing (subscription + credit products)

All env vars are validated at startup via T3Env + Zod in `src/env.ts`.

---

## Code Conventions

- **Linting/Formatting:** Biome (`pnpm check` before committing)
- **TypeScript:** Strict mode; path alias `@/*` maps to `src/*`
- **Server-only code:** Files suffixed `.server.ts` contain server-side logic; never import into client components directly
- **Server functions:** Use TanStack Start `createServerFn` for type-safe server calls from client
- **IDs:** UUIDv7 via `src/lib/id.ts`
- **Validation:** Zod schemas throughout; T3Env for env vars
- **Toasts:** Sonner (`sonner` package)
- **React:** React 19 with Babel React Compiler plugin enabled

---

## Testing

```bash
pnpm test           # Run all tests (Vitest + React Testing Library + JSDOM)
```

Tests live alongside source files or in `__tests__/` directories.
