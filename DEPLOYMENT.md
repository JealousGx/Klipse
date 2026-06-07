# Klipse — Deployment Guide

Complete step-by-step guide to deploy all services to production, staying within free tiers.

---

## Architecture Overview

| Service                               | Platform              | Cost                              |
| ------------------------------------- | --------------------- | --------------------------------- |
| **Main app** (TanStack Start SSR)     | Cloudflare Pages      | Free                              |
| **external-video-processor** (FFmpeg) | GCP Cloud Run         | Free tier                         |
| **Database**                          | TiDB Cloud Serverless | Free tier                         |
| **Storage**                           | Cloudflare R2         | Free tier (10 GB / 1M ops)        |
| **Email**                             | Resend                | Free tier (100 emails/day)        |
| **Billing**                           | Polar                 | Free (percentage-based fees only) |
| **Cron**                              | cron-job.org          | Free                              |

---

## Prerequisites

### Accounts to create (all free unless noted)

1. [Cloudflare](https://dash.cloudflare.com/sign-up) — main app + R2
2. [Google Cloud Platform](https://console.cloud.google.com) — video processor (requires credit card for billing activation, but won't charge within free tier)
3. [TiDB Cloud](https://tidbcloud.com) — database
4. [Resend](https://resend.com) — transactional email
5. [Polar](https://polar.sh) — billing / subscriptions
6. [Google Cloud Console](https://console.cloud.google.com) — Google OAuth + YouTube OAuth + Google TTS
7. [cron-job.org](https://cron-job.org) — scheduled jobs (free)
8. [Sentry](https://sentry.io) (optional) — error tracking
9. [Discord](https://discord.com) — bug report webhook (required by env schema)

### Tools to install locally

```bash
# Node.js >= 23
node --version  # must be >= 23.0.0

# pnpm 10
corepack enable && corepack prepare pnpm@10.31.0 --activate

# Wrangler CLI (Cloudflare)
pnpm add -g wrangler

# Google Cloud CLI
# macOS: brew install google-cloud-sdk
# Linux: https://cloud.google.com/sdk/docs/install

# Terraform
# macOS: brew install terraform
# Linux: https://developer.hashicorp.com/terraform/install

# Docker (for building + pushing processor image)
docker --version
```

---

## Part 1 — TiDB Cloud (Database)

### 1.1 Create a free serverless cluster

1. Sign in at [tidbcloud.com](https://tidbcloud.com)
2. Click **Create Cluster** → select **Serverless**
3. Region: `us-east-1` (or closest to your Cloudflare data center)
4. Cluster name: `klipse`
5. Click **Create** — free tier gives 5 GB storage + 50M row units/month

### 1.2 Get connection string

1. Cluster page → **Connect** → **General**
2. Select **Node.js** driver
3. Copy the connection string. Format:
   ```
   mysql2://username:password@gateway.tidbcloud.com:4000/klipse?ssl={"rejectUnauthorized":true}
   ```
4. Note: TiDB Cloud serverless requires SSL. The connection string includes it.

### 1.3 Run migrations

```bash
# From repo root
DATABASE_URL="<your-tidb-connection-string>" pnpm db:migrate
```

> Run this from your local machine. You only need to do this for initial setup and after each schema change.

---

## Part 2 — Cloudflare R2 (Storage)

### 2.1 Enable R2 on your Cloudflare account

1. Cloudflare dashboard → **R2 Object Storage** → **Get Started**
2. Free tier: 10 GB storage, 1M Class A ops/month, 10M Class B ops/month

### 2.2 Create the R2 bucket

```bash
wrangler login  # authenticate once

# Create bucket
wrangler r2 bucket create klipse-assets
```

Or via dashboard: R2 → **Create bucket** → name: `klipse-assets`, location: automatic.

### 2.3 Create R2 API credentials

1. Cloudflare dashboard → **R2** → **Manage R2 API tokens** → **Create API Token**
2. Permissions: **Object Read & Write**
3. Specify bucket: `klipse-assets`
4. Save these values — you'll need them later:
   - **Access Key ID** → `R2_ACCESS_KEY_ID`
   - **Secret Access Key** → `R2_SECRET_ACCESS_KEY`
   - **Account ID** (from dashboard URL or R2 overview) → `R2_ACCOUNT_ID`

### 2.4 Enable public access (for video URLs)

1. R2 bucket → **Settings** → **Public Access** → enable **R2.dev subdomain**
2. You'll get a URL like `https://pub-xxxx.r2.dev` → this is `R2_PUBLIC_BASE_URL` and `VITE_APP_R2_PUBLIC_BASE_URL`
3. Optional: set a custom domain instead for cleaner URLs

---

## Part 3 — Third-Party Services

### 3.1 Google OAuth (for auth + YouTube)

1. [Google Cloud Console](https://console.cloud.google.com) → **APIs & Services** → **Credentials**
2. **Create Credentials** → **OAuth 2.0 Client ID** → **Web application**
3. Name: `Klipse`
4. Authorized redirect URIs:
   ```
   https://your-app.pages.dev/api/auth/callback/google
   https://your-app.pages.dev/api/youtube/oauth/callback
   ```
   (Replace `your-app.pages.dev` with your actual domain after CF Pages is set up)
5. Save: **Client ID** → `GOOGLE_CLIENT_ID`, **Client Secret** → `GOOGLE_CLIENT_SECRET`
6. Enable APIs:
   ```
   YouTube Data API v3
   Cloud Text-to-Speech API
   ```
   Go to **APIs & Services** → **Library** and enable each.

### 3.2 Google TTS API Key

1. **APIs & Services** → **Credentials** → **Create Credentials** → **API Key**
2. Restrict to: **Cloud Text-to-Speech API**
3. Free tier: 1M WaveNet chars/month, 4M Standard chars/month
4. Value → `GOOGLE_TTS_API_KEYS` (comma-separated if using multiple keys)

### 3.3 Resend (Email)

1. Sign in at [resend.com](https://resend.com)
2. **API Keys** → **Create API Key** → full access
3. **Domains** → add and verify your sending domain (or use `onboarding@resend.dev` for testing)
4. Values:
   - API Key → `RESEND_API_KEY`
   - Sending address → `EMAIL_FROM` (e.g. `noreply@yourdomain.com`)

### 3.4 Polar (Billing)

1. Sign in at [polar.sh](https://polar.sh)
2. Create an organization matching your app name
3. Create products for each tier:
   - **Starter** → `POLAR_PRODUCT_STARTER`
   - **Creator** → `POLAR_PRODUCT_CREATOR`
   - **Empire** → `POLAR_PRODUCT_EMPIRE`
   - **Credits pack (small)** → `POLAR_PRODUCT_CREDITS`
   - **Credits pack (large)** → `POLAR_PRODUCT_CREDITS_LARGE`
4. **Settings** → **Webhooks** → create webhook:
   - URL: `https://your-app.pages.dev/api/auth/polar/webhook`
   - Events: `subscription.active`, `subscription.revoked`, `order.paid`
   - Secret → `POLAR_WEBHOOK_SECRET`
5. **Settings** → **Developers** → **Personal Access Token** → `POLAR_ACCESS_TOKEN`
6. Set `POLAR_SERVER=production` for live mode, `sandbox` for testing

### 3.5 OpenRouter (AI — Script generation)

1. Sign in at [openrouter.ai](https://openrouter.ai)
2. **API Keys** → create key → `OPENROUTER_API_KEYS`
3. Free models available (`:free` suffix). Default configured in `env.ts`:
   - Primary: `google/gemma-4-26b-a4b-it:free`
   - Fallback: `nvidia/nemotron-nano-12b-v2-vl:free`
4. No cost needed if using free models only

### 3.6 Discord Bug Report Webhook (Required)

1. In a Discord server you control: channel settings → **Integrations** → **Webhooks** → **New Webhook**
2. Copy webhook URL → `DISCORD_BUG_REPORT_WEBHOOK_URL`
3. This env var is **required** (not optional). App won't start without it.

### 3.7 Sentry (Optional but recommended)

1. Sign in at [sentry.io](https://sentry.io) — free tier: 5K errors/month
2. Create two projects: `klipse-main` (React) and `klipse-processor` (Node)
3. For `klipse-main`: Settings → Client Keys → DSN
   - Server DSN → `SENTRY_DSN`
   - Same DSN → `VITE_APP_SENTRY_DSN` (client-side, safe to expose)
4. Auth token for source maps: Settings → Auth Tokens → Create Internal Token (scope: `project:releases`, `org:read`) → `SENTRY_AUTH_TOKEN`

---

## Part 4 — Main App → Cloudflare Pages

### 4.1 Update vite.config.ts for CF Pages

The app detects `ENVIRONMENT=production` to enable CF workerd SSR mode. No code change needed — just set the env var in CF Pages (see Part 6).

Also add the `server.preset` to the TanStack Start plugin:

```ts
// vite.config.ts
tanstackStart({
  server: {
    preset: 'cloudflare-pages',
  }
}),
```

> Commit this change before deploying.

### 4.2 Option A — Deploy via GitHub integration (recommended)

1. Cloudflare dashboard → **Pages** → **Create a project** → **Connect to Git**
2. Select your repository
3. Configure build:
   - **Framework preset**: None
   - **Build command**: `pnpm install && pnpm build`
   - **Build output directory**: `.output/public`
   - **Root directory**: `/` (leave blank)
4. Add all environment variables (see Part 5 below) in **Environment variables** section
5. Click **Save and Deploy**

CF Pages auto-deploys on every push to main.

### 4.3 Option B — Deploy via Wrangler CLI

```bash
# From repo root
pnpm build

# First deploy (creates the Pages project)
wrangler pages project create klipse

# Deploy
wrangler pages deploy .output/public --project-name klipse
```

### 4.4 Set environment variables for CF Pages

Either via dashboard (step 4.2) or via CLI:

```bash
# Each secret is set individually
wrangler pages secret put DATABASE_URL --project-name klipse
wrangler pages secret put GOOGLE_CLIENT_ID --project-name klipse
# ... repeat for all env vars (see Part 5)
```

> For `VITE_` prefixed variables, set them as **plain env vars** (not secrets) since they're baked into the build at compile time.

### 4.5 Set VITE\_ variables at build time

In CF Pages dashboard → **Settings** → **Environment Variables** → **Production**:

Add these as plain variables (not encrypted):

```
VITE_APP_URL=https://klipse.pages.dev
VITE_APP_R2_PUBLIC_BASE_URL=https://pub-xxxx.r2.dev
VITE_APP_SUPPORT_EMAIL=support@yourdomain.com
VITE_APP_TITLE=Klipse
VITE_APP_SENTRY_DSN=https://xxx@sentry.io/xxx
VITE_APP_DISCORD_URL=https://discord.gg/xxx
VITE_APP_FEATURE_BASE_URL=https://yourapp.featurebase.app
```

### 4.6 Custom domain (optional)

1. CF Pages → **Custom domains** → **Set up a custom domain**
2. Enter your domain (must be on Cloudflare DNS)
3. Update Google OAuth authorized redirect URIs to use the custom domain

### 4.7 Update Google OAuth redirect URIs

After you have the final Pages URL, go back to Google Cloud Console → OAuth credentials → add:

```
https://your-final-domain.com/api/auth/callback/google
https://your-final-domain.com/api/youtube/oauth/callback
```

---

## Part 5 — Environment Variables Reference

### Main App (CF Pages)

Set all of these in CF Pages → Settings → Environment Variables.

```bash
# ── Core ───────────────────────────────────────────────────────────────────
ENVIRONMENT=production
DATABASE_URL=mysql2://user:pass@gateway.tidbcloud.com:4000/klipse?ssl={"rejectUnauthorized":true}
SERVER_URL=https://your-app.pages.dev
BETTER_AUTH_URL=https://your-app.pages.dev
BETTER_AUTH_SECRET=                  # openssl rand -hex 32

# ── Auth ───────────────────────────────────────────────────────────────────
GOOGLE_CLIENT_ID=                    # Google Cloud Console → Credentials
GOOGLE_CLIENT_SECRET=                # Google Cloud Console → Credentials
YOUTUBE_OAUTH_STATE_SECRET=          # openssl rand -hex 32

# ── Cron auth ──────────────────────────────────────────────────────────────
INTERNAL_CRON_SECRET=                # openssl rand -hex 32 (REQUIRED — bearer token for all /api/cron/* endpoints)

# ── Storage (R2) ────────────────────────────────────────────────────────────
R2_ACCOUNT_ID=                       # Cloudflare dashboard → right sidebar or R2 overview
R2_ACCESS_KEY_ID=                    # R2 → Manage API tokens
R2_SECRET_ACCESS_KEY=                # R2 → Manage API tokens
R2_BUCKET_NAME=klipse-assets
R2_PUBLIC_BASE_URL=https://pub-xxxx.r2.dev

# ── Email ──────────────────────────────────────────────────────────────────
RESEND_API_KEY=                      # Resend → API Keys
EMAIL_FROM=noreply@yourdomain.com

# ── Billing (Polar) ────────────────────────────────────────────────────────
POLAR_WEBHOOK_SECRET=                # Polar → Webhooks → secret
POLAR_ACCESS_TOKEN=                  # Polar → Settings → Access Token
POLAR_SERVER=production              # or sandbox for testing
POLAR_PRODUCT_STARTER=               # Polar product ID for Starter plan
POLAR_PRODUCT_CREATOR=               # Polar product ID for Creator plan
POLAR_PRODUCT_EMPIRE=                # Polar product ID for Empire plan
POLAR_PRODUCT_CREDITS=               # Polar product ID for small credit pack
POLAR_PRODUCT_CREDITS_LARGE=         # Polar product ID for large credit pack

# ── Video Processor ─────────────────────────────────────────────────────────
VIDEO_PROCESSOR_URL=https://klipse-processor-xxxx-uc.a.run.app  # Cloud Run URL (from Part 6)
VIDEO_PROCESSOR_CLIENT_SECRET=       # Must match secret in GCP Secret Manager
VIDEO_PROCESSOR_WEBHOOK_SECRET=      # Must match secret in GCP Secret Manager
APP_PUBLIC_URL=https://your-app.pages.dev  # Webhook base URL sent to processor

# ── AI Providers ────────────────────────────────────────────────────────────
OPENROUTER_API_KEYS=                 # openrouter.ai → API Keys (comma-separated)
GEMINI_API_KEYS=                     # Google AI Studio → API Key (comma-separated)
GOOGLE_TTS_API_KEYS=                 # Google Cloud Console → API Keys (comma-separated)
REPLICATE_API_KEYS=                  # replicate.com → API tokens (optional)
UNREAL_SPEECH_API_KEYS=              # unrealspeech.com → API keys (optional)
ELEVENLABS_API_KEYS=                 # elevenlabs.io → API keys (optional, Creator+ only)

# ── Other ───────────────────────────────────────────────────────────────────
DISCORD_BUG_REPORT_WEBHOOK_URL=      # Discord channel → Integrations → Webhooks (REQUIRED)
ADMIN_EMAILS=                        # comma-separated emails for admin access (optional)
SENTRY_DSN=                          # Sentry → Project → Client Keys (optional)
SENTRY_AUTH_TOKEN=                   # Sentry → Auth Tokens (only needed at build time)

# ── Client-side (VITE_ prefix — set as plain env vars, not secrets) ─────────
VITE_APP_URL=https://your-app.pages.dev
VITE_APP_R2_PUBLIC_BASE_URL=https://pub-xxxx.r2.dev
VITE_APP_SUPPORT_EMAIL=support@yourdomain.com
VITE_APP_TITLE=Klipse
VITE_APP_SENTRY_DSN=                 # Same DSN as SENTRY_DSN (safe to expose)
VITE_APP_DISCORD_URL=https://discord.gg/xxx    # optional
VITE_APP_FEATURE_BASE_URL=https://yourapp.featurebase.app  # optional
```

### external-video-processor (GCP Secret Manager)

Already set in Part 6.3. Accessed via `local.processor_secrets` in Terraform.

---

## Part 6 — Video Processor → GCP Cloud Run

### 6.1 GCP project setup

```bash
# Authenticate
gcloud auth login
gcloud auth application-default login

# Create project
gcloud projects create klipse-processor --name="Klipse Processor"
gcloud config set project klipse-processor

# Enable billing (required even for free tier)
# Go to: https://console.cloud.google.com/billing
# Link a billing account to the project

# Enable required APIs
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com
```

### 6.2 Set up Terraform

Create the Terraform directory in the repo:

```bash
mkdir -p terraform
```

Create `terraform/main.tf`:

```hcl
terraform {
  required_version = ">= 1.5"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
  # Store state locally for now. For team usage, migrate to GCS backend:
  # backend "gcs" { bucket = "your-tfstate-bucket" prefix = "klipse-processor" }
}

variable "gcp_project_id" {
  description = "GCP project ID"
  type        = string
  default     = "klipse-processor"
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

variable "image_tag" {
  description = "Docker image tag to deploy"
  type        = string
  default     = "latest"
}

provider "google" {
  project = var.gcp_project_id
  region  = var.region
}

# Artifact Registry repository for Docker images
resource "google_artifact_registry_repository" "klipse" {
  location      = var.region
  repository_id = "klipse"
  format        = "DOCKER"
  description   = "Klipse Docker images"
}

# Service account for Cloud Run
resource "google_service_account" "processor" {
  account_id   = "klipse-processor"
  display_name = "Klipse Processor Service Account"
}

# Cloud Run service
resource "google_cloud_run_v2_service" "processor" {
  name     = "klipse-processor"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.processor.email

    containers {
      image = "${var.region}-docker.pkg.dev/${var.gcp_project_id}/klipse/processor:${var.image_tag}"

      ports {
        container_port = 8790
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
        # CPU only allocated during active requests (scale-to-zero)
        cpu_idle          = true
        startup_cpu_boost = true
      }

      env {
        name  = "PORT"
        value = "8790"
      }
      env {
        name  = "NODE_ENV"
        value = "production"
      }

      # Secrets are set via GCP Secret Manager.
      # See Part 6.3 for how to populate them.
      dynamic "env" {
        for_each = local.processor_secrets
        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = env.value
              version = "latest"
            }
          }
        }
      }

      startup_probe {
        http_get {
          path = "/health"
          port = 8790
        }
        initial_delay_seconds = 5
        timeout_seconds       = 3
        period_seconds        = 5
        failure_threshold     = 3
      }

      liveness_probe {
        http_get {
          path = "/health"
          port = 8790
        }
        timeout_seconds   = 3
        period_seconds    = 30
        failure_threshold = 3
      }
    }

    scaling {
      min_instance_count = 0  # Scale to zero (saves cost)
      max_instance_count = 1  # Hard cap at 1 instance (free tier protection)
    }

    timeout = "600s"  # 10 min max for long video encoding jobs
  }

  lifecycle {
    ignore_changes = [
      # Prevent Terraform from re-deploying just because image digest changed
      template[0].containers[0].image
    ]
  }
}

# Allow unauthenticated invocations (bearer token auth handled in app code)
resource "google_cloud_run_v2_service_iam_member" "public" {
  name     = google_cloud_run_v2_service.processor.name
  location = google_cloud_run_v2_service.processor.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Grant Secret Manager access to service account
resource "google_project_iam_member" "processor_secrets" {
  project = var.gcp_project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.processor.email}"
}

locals {
  # Map: env var name → GCP Secret Manager secret name.
  # Processor only needs auth secrets — R2 and AI provider keys are passed via
  # ProcessorJobSpec at job time (main app is source of truth).
  processor_secrets = {
    APP_PUBLIC_URL                 = "klipse-app-public-url"
    VIDEO_PROCESSOR_CLIENT_SECRET  = "klipse-video-processor-client-secret"
    VIDEO_PROCESSOR_WEBHOOK_SECRET = "klipse-video-processor-webhook-secret"
    SENTRY_DSN                     = "klipse-processor-sentry-dsn"
  }
}

output "processor_url" {
  description = "Cloud Run service URL — set as VIDEO_PROCESSOR_URL in main app"
  value       = google_cloud_run_v2_service.processor.uri
}

output "artifact_registry_host" {
  description = "Docker push target prefix"
  value       = "${var.region}-docker.pkg.dev/${var.gcp_project_id}/klipse"
}
```

### 6.3 Create GCP secrets

```bash
# Enable Secret Manager API
gcloud services enable secretmanager.googleapis.com

# Helper function for creating secrets
create_secret() {
  echo -n "$2" | gcloud secrets create "$1" \
    --data-file=- \
    --replication-policy=automatic
}

# Run once — replace placeholder values with real ones
create_secret klipse-app-public-url                "https://your-app.pages.dev"
create_secret klipse-video-processor-client-secret  "$(openssl rand -hex 32)"
create_secret klipse-video-processor-webhook-secret "$(openssl rand -hex 32)"
create_secret klipse-processor-sentry-dsn          "<sentry-dsn-or-empty>"
```

> To update a secret later:
>
> ```bash
> echo -n "new-value" | gcloud secrets versions add klipse-app-public-url --data-file=-
> ```

### 6.4 Build and push Docker image

```bash
# Configure Docker to use GCP Artifact Registry
gcloud auth configure-docker us-central1-docker.pkg.dev

# Build from repo root (Dockerfile copies workspace files)
docker build \
  -f docker/external-video-processor/Dockerfile \
  -t us-central1-docker.pkg.dev/klipse-processor/klipse/processor:latest \
  .

# Push
docker push us-central1-docker.pkg.dev/klipse-processor/klipse/processor:latest
```

> For CI/CD, tag with the git SHA for traceability:
>
> ```bash
> IMAGE_TAG=$(git rev-parse --short HEAD)
> docker build ... -t "...:${IMAGE_TAG}" .
> docker push "...:${IMAGE_TAG}"
> ```

### 6.5 Terraform apply

```bash
cd terraform

# Initialize
terraform init

# Preview changes
terraform plan

# Apply
terraform apply
```

After apply, Terraform prints the `processor_url` (e.g. `https://klipse-processor-xxxx-uc.a.run.app`).

This URL becomes `VIDEO_PROCESSOR_URL` in your main app environment variables.

### 6.6 Verify Cloud Run health

```bash
curl https://klipse-processor-xxxx-uc.a.run.app/health
# Should return: ok
```

---

## Part 7 — Cron Jobs (cron-job.org)

Three endpoints need periodic calls. Use [cron-job.org](https://cron-job.org) (free, no account limit).

For each cron job, set header: `Authorization: Bearer <INTERNAL_CRON_SECRET>`

| Endpoint                           | Method | Schedule         | Purpose                                 |
| ---------------------------------- | ------ | ---------------- | --------------------------------------- |
| `/api/cron/dispatch-queued-jobs`   | POST   | Every 1 minute   | Pick up queued jobs → send to processor |
| `/api/cron/trigger-scheduled-jobs` | POST   | Every 15 minutes | Fire any scheduled channel jobs         |
| `/api/cron/purge-expiring-assets`  | POST   | Every hour       | Clean up R2 temp assets                 |

Steps:

1. Sign in at [cron-job.org](https://cron-job.org)
2. **Create cronjob** for each row above
3. URL: `https://your-app.pages.dev/<endpoint>`
4. Method: POST
5. Headers → add: `Authorization: Bearer <INTERNAL_CRON_SECRET>`
6. Schedule: set per table above

---

## Part 8 — CI/CD (GitHub Actions)

### 8.1 Main app — automatic via CF Pages

CF Pages auto-deploys on every push to `main` when connected to GitHub (Part 4.2). No additional CI/CD needed.

### 8.2 Video processor — build + push + deploy on push

Create `.github/workflows/deploy-processor.yml`:

```yaml
name: Deploy video processor

on:
  push:
    branches: [main]
    paths:
      - "packages/external-video-processor/**"
      - "packages/video-assembly-shared/**"
      - "docker/external-video-processor/**"

env:
  GCP_PROJECT: klipse-processor
  REGION: us-central1
  IMAGE: us-central1-docker.pkg.dev/klipse-processor/klipse/processor

jobs:
  deploy:
    name: Build and deploy
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write # For Workload Identity Federation (keyless auth)

    steps:
      - uses: actions/checkout@v4

      - name: Authenticate to GCP
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.GCP_WORKLOAD_IDENTITY_PROVIDER }}
          service_account: ${{ secrets.GCP_SERVICE_ACCOUNT }}

      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v2

      - name: Configure Docker for Artifact Registry
        run: gcloud auth configure-docker ${{ env.REGION }}-docker.pkg.dev

      - name: Build and push Docker image
        run: |
          IMAGE_TAG="${{ github.sha }}"
          docker build \
            -f docker/external-video-processor/Dockerfile \
            -t "${{ env.IMAGE }}:${IMAGE_TAG}" \
            -t "${{ env.IMAGE }}:latest" \
            .
          docker push "${{ env.IMAGE }}:${IMAGE_TAG}"
          docker push "${{ env.IMAGE }}:latest"

      - name: Deploy to Cloud Run
        run: |
          gcloud run deploy klipse-processor \
            --image "${{ env.IMAGE }}:${{ github.sha }}" \
            --region ${{ env.REGION }} \
            --project ${{ env.GCP_PROJECT }}
```

**GCP Workload Identity setup** (keyless auth — more secure than service account keys):

```bash
# Create Workload Identity Pool for GitHub
gcloud iam workload-identity-pools create github \
  --project klipse-processor \
  --location global \
  --display-name "GitHub Actions"

# Create provider
gcloud iam workload-identity-pools providers create-oidc github-actions \
  --project klipse-processor \
  --location global \
  --workload-identity-pool github \
  --display-name "GitHub Actions OIDC" \
  --attribute-mapping "google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --issuer-uri "https://token.actions.githubusercontent.com"

# Allow the GitHub repo to impersonate the service account
gcloud iam service-accounts add-iam-policy-binding \
  klipse-processor@klipse-processor.iam.gserviceaccount.com \
  --project klipse-processor \
  --role roles/iam.workloadIdentityUser \
  --member "principalSet://iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github/attribute.repository/YOUR_GITHUB_ORG/YOUR_REPO"
  # Replace PROJECT_NUMBER with: gcloud projects describe klipse-processor --format='value(projectNumber)'
  # Replace YOUR_GITHUB_ORG/YOUR_REPO with e.g. khilji/klipse

# Get the provider name for GitHub secret
gcloud iam workload-identity-pools providers describe github-actions \
  --project klipse-processor \
  --location global \
  --workload-identity-pool github \
  --format "value(name)"
# Output → GCP_WORKLOAD_IDENTITY_PROVIDER secret value
```

**GitHub secrets to add:**

- `GCP_WORKLOAD_IDENTITY_PROVIDER` — output from above
- `GCP_SERVICE_ACCOUNT` — `klipse-processor@klipse-processor.iam.gserviceaccount.com`

---

## Part 9 — DB Migrations in CI

Run migrations after deploying the main app when schema changes:

```yaml
# Add to your main app deploy workflow (or run manually)
- name: Run DB migrations
  run: pnpm db:migrate
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

Or run locally whenever you push schema changes:

```bash
DATABASE_URL="<tidb-url>" pnpm db:migrate
```

---

## Part 10 — Free Tier Limits Summary

| Service                   | Free Limit                                           | Your Usage Pattern     |
| ------------------------- | ---------------------------------------------------- | ---------------------- |
| **CF Pages**              | Unlimited requests, 500 builds/month                 | Main app               |
| **CF R2**                 | 10 GB storage, 1M Class A ops, 10M Class B ops/month | Video output storage   |
| **GCP Cloud Run**         | 2M requests, 360K GB-sec, 180K vCPU-sec/month        | Video processor        |
| **GCP Artifact Registry** | 0.5 GB storage/month                                 | Processor Docker image |
| **TiDB Cloud**            | 5 GB storage, 50M row units/month                    | Database               |
| **Resend**                | 100 emails/day, 3K/month                             | Auth OTP emails        |
| **OpenRouter**            | Free models (`:free` suffix) unlimited\*             | AI script generation   |
| **Google TTS**            | 1M WaveNet chars/month, 4M Standard                  | TTS audio              |
| **Sentry**                | 5K errors/month                                      | Error tracking         |
| **cron-job.org**          | Unlimited cron jobs                                  | Job dispatch + cleanup |

\*OpenRouter free models have rate limits per model; using multiple keys/models mitigates this.

### Hard limits to watch

- **Cloud Run vCPU-seconds**: 180K/month = ~50 hours 1-vCPU. A 2-minute encode ≈ 120 vCPU-seconds. So ~1,500 videos/month before cost. `max_instance_count=1` prevents runaway.
- **R2 Class A ops** (writes): 1M/month. Each video upload = ~1 write. Very unlikely to hit.
- **TiDB row units**: 50M/month. Each query consumes row units. Monitor in TiDB Cloud dashboard.

---

## Part 11 — First Deployment Checklist

Run through this in order:

- [ ] Create TiDB Cloud cluster and run `pnpm db:migrate`
- [ ] Create Cloudflare R2 bucket and API credentials
- [ ] Set up Google OAuth credentials and enable APIs
- [ ] Create Resend API key and verify sending domain
- [ ] Set up Polar products, webhook, and access token
- [ ] Create Discord webhook URL
- [ ] Get OpenRouter API key (and optionally Gemini, Google TTS, Replicate, etc.)
- [ ] Set up Sentry projects (optional)
- [ ] Generate strong random secrets: `YOUTUBE_OAUTH_STATE_SECRET`, `VIDEO_PROCESSOR_CLIENT_SECRET`, `VIDEO_PROCESSOR_WEBHOOK_SECRET`, `INTERNAL_CRON_SECRET`, `BETTER_AUTH_SECRET`
- [ ] Create GCP project + enable billing + enable APIs
- [ ] Create GCP secrets (`gcloud secrets create ...`)
- [ ] Run `terraform init && terraform apply` (creates Artifact Registry + Cloud Run)
- [ ] Build + push Docker image for processor
- [ ] Verify processor health: `curl https://<processor-url>/health`
- [ ] Add `server: { preset: 'cloudflare-pages' }` to `tanstackStart()` in `vite.config.ts`
- [ ] Connect GitHub repo to CF Pages and configure build settings
- [ ] Set all environment variables in CF Pages dashboard (including `ENVIRONMENT=production`)
- [ ] Trigger first CF Pages deploy
- [ ] Update Google OAuth redirect URIs with final app URL
- [ ] Update Polar webhook URL with final app URL
- [ ] Update `klipse-app-public-url` GCP secret to final app URL
- [ ] Set up cron jobs on cron-job.org (3 endpoints — see Part 7)
- [ ] Test full flow: register → generate video → auto-publish

---

## Troubleshooting

### CF Pages build fails

- Check build logs in CF Pages dashboard → Deployments
- Common issue: missing `VITE_` env vars at build time (must be plain vars, not secrets)
- Ensure `pnpm-lock.yaml` is committed
- Ensure `ENVIRONMENT=production` is set (enables CF workerd SSR mode)

### Video processor 500 error

```bash
# Check Cloud Run logs
gcloud run services logs read klipse-processor --region us-central1 --limit 50
```

### Jobs stuck in queued state

- Check cron-job.org execution history — confirm `dispatch-queued-jobs` is firing every minute
- Verify `INTERNAL_CRON_SECRET` in CF Pages matches what you configured in cron-job.org
- Check CF Pages function logs for errors from `/api/cron/dispatch-queued-jobs`

### DB migrations failing

- TiDB Cloud requires SSL. Ensure `?ssl={"rejectUnauthorized":true}` in connection string.
- Check TiDB Cloud IP allowlist — add `0.0.0.0/0` for CF Pages outbound IPs (dynamic, can't whitelist specific IPs).

### YouTube OAuth redirect mismatch

- Ensure both redirect URIs are added in Google Console (auth callback + youtube callback)
- Both must use HTTPS and exactly match the CF Pages domain (including no trailing slash)
