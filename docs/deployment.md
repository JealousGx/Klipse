# Deployment

Klipse has three deployable services:

| Service | Platform | Command |
|---|---|---|
| Main app | Cloudflare Workers | `pnpm deploy` |
| Video processor | GCP Cloud Run **GPU** (Docker, self-hosted LTX-2.3) | Manual push + Cloud Run console config |
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
wrangler secret put VIDEO_PROCESSOR_WEBHOOK_SECRET
wrangler secret put GCP_SERVICE_ACCOUNT_EMAIL
wrangler secret put GCP_SERVICE_ACCOUNT_PRIVATE_KEY
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
  "GCP_PROJECT_ID": "klipse-492407",
  "GCP_RUN_REGION": "us-central1",
  "GCP_RUN_JOB_NAME": "klipse-processor-job",
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
  "VITE_APP_R2_PUBLIC_BASE_URL": "https://...",
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

## Video Processor (GCP Cloud Run **Job**, with GPU)

A self-hosted LTX-2.3 Python service, run as a Cloud Run **Job** (not a Service) — every execution is triggered on-demand by the main app via the Cloud Run Admin API (`jobs.run`), processes exactly one `video_jobs` row, and exits. There is no long-lived HTTP server, no `VIDEO_PROCESSOR_URL`, no console-configured concurrency/scaling — an earlier Service-based version of this doc described that architecture, which no longer exists.

Model weights **are baked into the image**, downloaded directly from Hugging Face inside `processor/Dockerfile` as an early layer (before `COPY src`). A GCS-volume-mount approach was tried in between (weights baked into a separate image, then a GCS-mounted runtime approach) but a real deploy confirmed the GCS FUSE mount satisfied weight reads lazily/on-demand rather than eagerly, causing a ~30min stall on every job's first forward pass — baking weights directly into the image avoids that entirely. See [docs/video-processor.md](video-processor.md#model-weights-baked-into-the-image--downloaded-from-hugging-face-at-build-time) for the full setup.

> **Note:** this deployment skipped the standalone GPU validation step (Phase 0 in the implementation plan) and staged rollout — by explicit decision, this went straight to production configuration and testing. Real generation quality/timing/VRAM headroom were not independently verified before go-live.

### 1. Build and push the app image (routine — every code change)

`processor/cloudbuild.yaml` (repo root, wired to an auto-trigger on push) handles this automatically:

```bash
docker build -f processor/Dockerfile -t us-central1-docker.pkg.dev/<PROJECT_ID>/klipse/processor:latest processor/
docker push us-central1-docker.pkg.dev/<PROJECT_ID>/klipse/processor:latest
gcloud run jobs deploy klipse-processor-job --image=us-central1-docker.pkg.dev/<PROJECT_ID>/klipse/processor:latest --region=us-central1
```

No registry-backed BuildKit cache is used (deliberately removed — see `processor/cloudbuild.yaml`'s own comments) — every build re-runs every step from scratch (system packages, the ~67GB weights download, pip installs, SageAttention's from-source compile), realistically 45min–1hr+ per build. Accepted tradeoff for a simpler build config, given infrequent pushes once the processor stabilizes. `options.machineType` is deliberately left unset (not explicitly `E2_STANDARD_2`, which isn't a valid enum value — omitting it is what actually gets the default `e2-standard-2` machine) since that's the **only** machine type covered by Cloud Build's 2500 free-minutes/month tier — the previous `E2_HIGHCPU_8` setting billed real money on every build and wasn't worth it once the build became network-download-bound rather than CPU-bound. `options.diskSizeGb: "300"` and top-level `timeout: "10800s"` are both real fixes for real failures hit deploying this (`ResourceExhausted: no space left on device` finalizing the weights layer, and Cloud Build's 60-minute default timeout).

### 2. Deploy the underlying infrastructure — Terraform (`processor/terraform/`)

GPU/timeout/IAM/the Artifact Registry repository are all Terraform-managed:

```bash
cd processor/terraform
terraform init
terraform plan
terraform apply
```

Resources managed: `google_artifact_registry_repository.klipse` (the processor image repo, including its cleanup policy — keeps the most recent 1 version indefinitely, deletes anything else older than 20 days), `google_service_account.processor_runtime` (the Job's own runtime identity) and `google_service_account.job_trigger` (what the main app authenticates as to call `jobs.run`), the IAM bindings between them, Secret Manager access grants, and `google_cloud_run_v2_job.processor` itself — GPU type (`nvidia-rtx-pro-6000`, no zonal redundancy), 20 CPU / 80Gi memory (GCP's enforced minimum for that GPU tier), 3600s timeout, `max_retries = 0` (retries go through the app's own `retryFailedJobForUser`, not silent auto-retry of a failed GPU job).

Routine image bumps (step 1's `gcloud run jobs deploy --image=...`) are excluded from Terraform's management via `lifecycle.ignore_changes`, so they don't fight each other.

### 3. What's still manual (not Terraform-managed, by choice or by real limitation)

- **Secret values** (`VIDEO_PROCESSOR_WEBHOOK_SECRET`, `AXIOM_API_TOKEN`) — only *access* to these is Terraform-managed; their actual values are created out-of-band (`gcloud secrets create` / `versions add`), deliberately, so secret material never lives in Terraform state.
- **The `job_trigger` service account's key** — generated out-of-band (`gcloud iam service-accounts keys create`) and stored as Cloudflare secrets (`GCP_SERVICE_ACCOUNT_EMAIL`/`GCP_SERVICE_ACCOUNT_PRIVATE_KEY`), same reasoning.
- **The Cloud Build trigger itself** (watching the GitHub repo, firing `cloudbuild.yaml` on push) — set up manually, not yet a `google_cloudbuild_trigger` Terraform resource.
- **The Cloud Build trigger's own service account IAM roles** — including `roles/logging.logWriter`, which was missing and caused a real build failure ("does not have permission to write logs to Cloud Logging") the first time a build ran without BuildKit's separate log-handling path. Not yet Terraform-managed.
- **GPU quota** in the target region — a genuine limitation, not a choice: quota increases for GPUs typically require a request/review process Terraform can't reliably automate.
- **Enabling required GCP APIs** (Cloud Run, Artifact Registry, Cloud Build, Secret Manager, IAM) for a brand-new project — currently assumed pre-enabled.

### 4. Update Main App

Set `GCP_PROJECT_ID`, `GCP_RUN_REGION`, `GCP_RUN_JOB_NAME`, `GCP_SERVICE_ACCOUNT_EMAIL`, `GCP_SERVICE_ACCOUNT_PRIVATE_KEY` in Wrangler secrets/vars — not `VIDEO_PROCESSOR_URL` (that env var belonged to the old Service architecture and no longer exists).

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
[ ] Video processor deployed with RTX Pro 6000 GPU tier, scale-to-zero, max_instance_count cap + budget alert, GCS weights volume mount, VIDEO_PROCESSOR_URL set
[ ] Google OAuth redirect URIs registered
[ ] Polar products created, webhook URL registered
[ ] Axiom log/trace destinations configured in CF dashboard
[ ] INTERNAL_CRON_SECRET set, cron jobs scheduled
[ ] ADMIN_EMAILS set for at least one admin account
[ ] pnpm deploy (main app)
```
