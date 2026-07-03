output "job_name" {
  description = "Cloud Run Job resource name — set as GCP_RUN_JOB_NAME in the main app."
  value       = google_cloud_run_v2_job.processor.name
}

output "job_trigger_service_account_email" {
  description = "Set as GCP_SERVICE_ACCOUNT_EMAIL in the main app. Generate its key separately: gcloud iam service-accounts keys create key.json --iam-account=<this-value>"
  value       = google_service_account.job_trigger.email
}

output "processor_runtime_service_account_email" {
  description = "The Job's own runtime identity (informational — the main app doesn't need this)."
  value       = google_service_account.processor_runtime.email
}
