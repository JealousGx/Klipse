# Deployment

Klipse has three deployable services:

| Service | Platform | Command |
|---|---|---|
| Main app | Cloudflare Workers | `pnpm deploy` |
| Video processor | GCP Cloud Run (Docker) | Manual push + Cloud Run deploy |
| Database | TiDB Cloud serverless | Managed — run `pnpm db:migrate` |

---

## Prerequisites

- Cloudflare account with Workers enabled
- Wrangler CLI authenticated: `wrangler login`
- Docker + GCP CLI (for processor)
- TiDB Cloud cluster (or any MySQL 8-compatible host)

---

## Main App (Cloudflare Workers)

### 1. Set Secrets

All non-public env vars must be set as Wrangler secrets (not in `wrangler.jsonc` `vars`):

```bash
wrangler secret put DATABASE_URL
wrangler secret put BETTER_AUTH_SECRET
wrangler secret put YOUTUBE_OAUTH_STATE_SECRET
wrangler secret put INTERNAL_CRON_SECRET
wrangler secret put R2_ACCESS_KEY_ID
wrangler secret put R2_SECRET_ACCESS_KEY
wrangler secret put VIDEO_PROCESSOR_CLIENT_SECRET
wrangler secret put VIDEO_PROCESSOR_WEBHOOK_SECRET
wrangler secret put POLAR_ACCESS_TOKEN
wrangler secret put POLAR_WEBHOOK_SECRET
wrangler secret put RESEND_API_KEY
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put SENTRY_AUTH_TOKEN
```

### 2. Update `wrangler.jsonc` Vars

Public/non-sensitive vars go in `wrangler.jsonc`:

```jsonc
"vars": {
  "ENVIRONMENT": "production",
  "KLIPSE_PERF_LOG": "1",
  "SERVER_URL": "https://klipse.app",
  "BETTER_AUTH_URL": "https://klipse.app",
  "APP_PUBLIC_URL": "https://klipse.app",
  "R2_ACCOUNT_ID": "...",
  "R2_BUCKET_NAME": "...",
  "R2_PUBLIC_BASE_URL": "https://...",
  "VIDEO_PROCESSOR_URL": "https://...",
  "GOOGLE_CLIENT_ID": "...",
  "POLAR_SERVER": "production",
  "POLAR_PRODUCT_STARTER": "...",
  "POLAR_PRODUCT_CREATOR": "...",
  "POLAR_PRODUCT_EMPIRE": "...",
  "POLAR_PRODUCT_CREDITS": "...",
  "POLAR_PRODUCT_CREDITS_LARGE": "...",
  "EMAIL_FROM": "...",
  "ADMIN_EMAILS": "...",
  "VITE_APP_TITLE": "Klipse",
  "VITE_APP_URL": "https://klipse.app",
  "VITE_APP_SUPPORT_EMAIL": "...",
}
```

### 3. Run Migrations

```bash
# Point DATABASE_URL at production DB
pnpm db:migrate
```

Or let `prebuild` handle it — `pnpm deploy` calls `pnpm build` which runs `pnpm db:migrate` first.

### 4. Deploy

```bash
pnpm deploy
# Equivalent: vite build && wrangler deploy
```

Deploys to `klipse.app` (production) per `wrangler.jsonc` routes config.

**Staging:**

```bash
wrangler deploy --env staging
# Deploys to staging.klipse.app
```

### 5. R2 CORS

Configure the R2 bucket to allow presigned PUT uploads from your domain:

```json
[
  {
    "AllowedOrigins": ["https://klipse.app"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"]
  }
]
```

### 6. Observability

In CF dashboard → Workers → `klipse` → Observability → Destinations:

1. Add destination `main-app-logs` (type: Logs)
   - Endpoint: `https://api.axiom.co/v1/logs`
   - Headers: `Authorization: Bearer <axiom-token>`, `X-Axiom-Dataset: klipse`

2. Add destination `main-app-traces` (type: Traces) — optional
   - Endpoint: `https://api.axiom.co/v1/traces`
   - Same headers

Destination names must match exactly what's in `wrangler.jsonc` `observability` block.

---

## Video Processor (GCP Cloud Run)

### 1. Build and Push

```bash
# Build image
pnpm processor:docker:build
# tag: klipse-external-video-processor:latest

# Tag for GCR
docker tag klipse-external-video-processor:latest \
  gcr.io/<PROJECT_ID>/klipse-video-processor:latest

# Push
docker push gcr.io/<PROJECT_ID>/klipse-video-processor:latest
```

### 2. Deploy to Cloud Run

```bash
gcloud run deploy klipse-video-processor \
  --image gcr.io/<PROJECT_ID>/klipse-video-processor:latest \
  --region us-central1 \
  --platform managed \
  --memory 2Gi \
  --cpu 2 \
  --timeout 900 \
  --set-env-vars "VIDEO_PROCESSOR_CLIENT_SECRET=...,VIDEO_PROCESSOR_WEBHOOK_SECRET=..."
```

Key Cloud Run settings:
- **Memory:** 2Gi+ (FFmpeg encode is memory-intensive)
- **Timeout:** 900s (15 min) — long jobs need this
- **Concurrency:** 1 per instance (FFmpeg is CPU-bound)

### 3. Update Main App

Set `VIDEO_PROCESSOR_URL` to the Cloud Run service URL in Wrangler secrets/vars.

---

## Cron Jobs

`/api/cron/*` endpoints require `Authorization: Bearer <INTERNAL_CRON_SECRET>`.

Set up on [cron-job.org](https://cron-job.org) or Cloudflare Cron Triggers:

| Endpoint | Schedule | Purpose |
|---|---|---|
| `/api/cron/purge-expiring-assets` | Daily | Delete expired R2 assets |
| `/api/cron/youtube-oauth-reconcile` | Every 6h | Refresh YouTube OAuth tokens |
| `/api/cron/dispatch-queued-jobs` | Every 5m | Re-dispatch stuck queued jobs |

---

## Google OAuth Setup

In Google Cloud Console:

1. Create OAuth 2.0 client (Web application type)
2. Add authorized JavaScript origins: `https://klipse.app`
3. Add authorized redirect URIs:
   - `https://klipse.app/api/auth/callback/google` (Better Auth social sign-in)
   - `https://klipse.app/api/youtube/oauth/callback` (YouTube channel connect)
4. Enable **YouTube Data API v3** in APIs & Services
5. Copy Client ID → `GOOGLE_CLIENT_ID`, Client Secret → `GOOGLE_CLIENT_SECRET`

---

## Database (TiDB Cloud)

1. Create a TiDB Cloud Serverless cluster
2. Copy connection string → `DATABASE_URL`
   - Format: `mysql://user:password@host:4000/klipse?ssl={"rejectUnauthorized":true}`
3. Run migrations: `pnpm db:migrate`

TiDB is MySQL 8-compatible. Drizzle ORM targets `provider: "mysql"`.

---

## Checklist

```
[ ] Wrangler secrets set (DATABASE_URL, auth secrets, API keys)
[ ] wrangler.jsonc vars updated for production domain
[ ] R2 bucket CORS configured
[ ] db:migrate run against production DB
[ ] Video processor deployed, VIDEO_PROCESSOR_URL set
[ ] Google OAuth redirect URIs registered
[ ] Polar products created, webhook URL registered
[ ] Axiom log/trace destinations configured in CF dashboard
[ ] INTERNAL_CRON_SECRET set, cron jobs scheduled
[ ] ADMIN_EMAILS set for at least one admin account
[ ] pnpm deploy (main app)
```
