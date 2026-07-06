terraform {
  required_version = ">= 1.5"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
  # Local state by default — this is applied manually by one operator, not from CI (see
  # cloudbuild.yaml: routine image bumps go through a lightweight `gcloud run jobs deploy`
  # that this resource explicitly ignores, not through `terraform apply`). Add a `backend
  # "gcs" {}` block here later if multiple people need to run `terraform apply`.
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# ---------------------------------------------------------------------------
# Runtime identity — what the Job's own container runs as. Needs read access to the
# secrets it's configured with below. Model weights are baked into the image itself
# (see processor/Dockerfile) — no GCS read access needed for weights anymore; a real
# deploy confirmed the GCS FUSE mount was satisfying weight reads lazily/on-demand
# rather than eagerly, causing a ~30min stall on every job's first forward pass.
# ---------------------------------------------------------------------------

resource "google_service_account" "processor_runtime" {
  account_id   = "klipse-processor-runtime"
  display_name = "Klipse processor Job — runtime identity"
}

resource "google_secret_manager_secret_iam_member" "processor_runtime_webhook_secret" {
  secret_id = var.webhook_secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.processor_runtime.email}"
}

resource "google_secret_manager_secret_iam_member" "processor_runtime_axiom_secret" {
  count     = var.axiom_api_token_secret_id == "" ? 0 : 1
  secret_id = var.axiom_api_token_secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.processor_runtime.email}"
}

# ---------------------------------------------------------------------------
# Trigger identity — what the main app (Cloudflare Worker) authenticates as to call the
# Cloud Run Admin API (`jobs.run`) and start an execution. A key for this account is
# generated out-of-band (`gcloud iam service-accounts keys create`) and stored as
# Cloudflare secrets (GCP_SERVICE_ACCOUNT_EMAIL / GCP_SERVICE_ACCOUNT_PRIVATE_KEY) — not
# managed here, since Terraform shouldn't be the thing handling that private key material.
# ---------------------------------------------------------------------------

resource "google_service_account" "job_trigger" {
  account_id   = var.job_trigger_service_account_id
  display_name = "Klipse app — trigger processor Job executions"
}

# jobsExecutorWithOverrides, not plain jobsExecutor — the trigger call passes KLIPSE_JOB_ID
# as a per-execution container override, which the plain executor role can't do.
resource "google_cloud_run_v2_job_iam_member" "job_trigger_can_run" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_job.processor.name
  role     = "roles/run.jobsExecutorWithOverrides"
  member   = "serviceAccount:${google_service_account.job_trigger.email}"
}

# ---------------------------------------------------------------------------
# The Job itself.
# ---------------------------------------------------------------------------

resource "google_cloud_run_v2_job" "processor" {
  name     = var.job_name
  location = var.region

  # This is a stateless compute definition, not a data-bearing resource — no risk from
  # deletion/recreation (unlike e.g. a database), and it may legitimately need replacing
  # if a change forces recreation (some Job fields are immutable after creation).
  deletion_protection = false

  template {
    parallelism = 1
    task_count  = 1

    template {
      # Not GCP-auto-retried — retries go through the app's own retryFailedJobForUser
      # (capped, user-triggered), not a silent automatic re-run of a failed GPU job.
      max_retries     = 0
      timeout         = var.task_timeout
      service_account = google_service_account.processor_runtime.email

      gpu_zonal_redundancy_disabled = true

      node_selector {
        accelerator = var.gpu_type
      }

      containers {
        image = var.image

        resources {
          limits = {
            cpu              = var.cpu
            memory           = var.memory
            "nvidia.com/gpu" = "1"
          }
        }

        env {
          name  = "KLIPSE_APP_BASE_URL"
          value = var.app_base_url
        }
        env {
          name  = "ENVIRONMENT"
          value = var.environment
        }
        env {
          name  = "KLIPSE_PERF_LOG"
          value = var.klipse_perf_log
        }
        env {
          name  = "AXIOM_DATASET"
          value = var.axiom_dataset
        }
        env {
          name = "VIDEO_PROCESSOR_WEBHOOK_SECRET"
          value_source {
            secret_key_ref {
              secret  = var.webhook_secret_id
              version = "latest"
            }
          }
        }
        dynamic "env" {
          for_each = var.axiom_api_token_secret_id == "" ? [] : [1]
          content {
            name = "AXIOM_API_TOKEN"
            value_source {
              secret_key_ref {
                secret  = var.axiom_api_token_secret_id
                version = "latest"
              }
            }
          }
        }
        # KLIPSE_JOB_ID is intentionally not set here — it's a per-execution override
        # supplied by the main app's `jobs.run` API call, not a static Job config value.
      }
    }
  }

  lifecycle {
    # Routine image bumps happen via `gcloud run jobs deploy --image=...` in
    # cloudbuild.yaml on every push — ignored here so `terraform apply` doesn't fight
    # that and redeploy an old/stale image tag back over a newer one.
    ignore_changes = [template[0].template[0].containers[0].image]
  }
}
