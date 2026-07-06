variable "project_id" {
  description = "GCP project the processor Job is deployed in."
  type        = string
}

variable "region" {
  description = "Region for the Cloud Run Job and its resources."
  type        = string
  default     = "us-central1"
}

variable "job_name" {
  description = "Cloud Run Job resource name."
  type        = string
  default     = "klipse-processor-job"
}

variable "image" {
  description = "Container image for the Job. Only used on the very first apply — ongoing image bumps happen via `gcloud run jobs deploy` in cloudbuild.yaml, which this resource ignores changes to (see lifecycle block in main.tf)."
  type        = string
}

variable "triton_cache_bucket_name" {
  description = "GCS bucket mounted read-write at TRITON_CACHE_DIR/TORCHINDUCTOR_CACHE_DIR so compiled kernels survive across Cloud Run Job executions (each execution gets a fresh container otherwise, forcing recompilation on every single job). Created by this Terraform config."
  type        = string
  default     = "klipse-processor-triton-cache"
}

variable "app_base_url" {
  description = "Main app base URL — the Job container fetches its own spec from here and calls back progress/completion (KLIPSE_APP_BASE_URL env var)."
  type        = string
}

variable "webhook_secret_id" {
  description = "Secret Manager secret ID (name, not full resource path) holding VIDEO_PROCESSOR_WEBHOOK_SECRET — shared bearer for the job-spec fetch and all callbacks."
  type        = string
}

variable "axiom_api_token_secret_id" {
  description = "Secret Manager secret ID holding the Axiom API token. Leave empty to disable the Axiom log drain (still logs to stdout / Cloud Logging either way)."
  type        = string
  default     = ""
}

variable "axiom_dataset" {
  description = "Axiom dataset name to ingest into."
  type        = string
  default     = "klipse"
}

variable "environment" {
  description = "Deployment label — controls log verbosity."
  type        = string
  default     = "production"
}

variable "klipse_perf_log" {
  description = "Set to \"1\" to enable info-level logs in production."
  type        = string
  default     = ""
}

variable "job_trigger_service_account_id" {
  description = "Account ID (not full email) of the service account the main app uses to trigger Job executions via the Cloud Run Admin API."
  type        = string
  default     = "klipse-job-trigger"
}

variable "gpu_type" {
  description = "GPU accelerator type. LTX-2.3 needs 32GB+ VRAM, which rules out the cheaper L4 tier."
  type        = string
  default     = "nvidia-rtx-pro-6000"
}

variable "cpu" {
  description = "vCPU limit — GCP requires 20 CPU minimum for the RTX Pro 6000 GPU tier."
  type        = string
  default     = "20"
}

variable "memory" {
  description = "Memory limit — GCP requires 80Gi minimum for the RTX Pro 6000 GPU tier."
  type        = string
  default     = "80Gi"
}

variable "task_timeout" {
  description = "Max time a single task attempt can run (script gen + model load + generation + upload)."
  type        = string
  default     = "3600s"
}
