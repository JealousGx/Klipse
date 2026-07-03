"""Cloud Run Job entrypoint — one execution processes exactly one video_jobs row, then
exits. Replaces the old FastAPI Service + in-process queue/worker: the main app now
triggers a Job execution (Cloud Run Admin API `jobs.run`) instead of POSTing to a
long-lived HTTP server, passing only `KLIPSE_JOB_ID` as a per-execution override. This
container fetches its own full spec from the main app, so provider-key secrets and
prompt text never have to travel through a GCP API call payload.

Required env vars (static, set on the Job resource, not per-execution):
  KLIPSE_APP_BASE_URL           main app base URL (e.g. https://klipse.app)
  VIDEO_PROCESSOR_WEBHOOK_SECRET  bearer secret for both the job-spec fetch below and
                                   the progress/complete callbacks inside job.py

Required env var (per-execution override, set by the Cloud Run Admin API `run` call):
  KLIPSE_JOB_ID
"""

import asyncio
import os
import sys

import httpx

from .job import ProcessorJobSpecIn, run_job
from .logger import logger


async def _fetch_spec(app_base_url: str, webhook_secret: str, job_id: str) -> ProcessorJobSpecIn:
    url = f"{app_base_url.rstrip('/')}/api/internal/processor/job-spec"
    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.get(
            url,
            params={"jobId": job_id},
            headers={"Authorization": f"Bearer {webhook_secret}"},
        )
        if res.status_code != 200:
            raise RuntimeError(f"job_spec_fetch_failed:{res.status_code}:{res.text[:300]}")
        data = res.json()
        if not data.get("ok"):
            raise RuntimeError(f"job_spec_fetch_failed:{data.get('error', 'unknown')}")
        return ProcessorJobSpecIn.model_validate(data["spec"])


async def _main() -> int:
    job_id = os.environ.get("KLIPSE_JOB_ID", "").strip()
    app_base_url = os.environ.get("KLIPSE_APP_BASE_URL", "").strip()
    webhook_secret = os.environ.get("VIDEO_PROCESSOR_WEBHOOK_SECRET", "").strip()

    if not job_id or not app_base_url or not webhook_secret:
        logger.error(
            "job_main_missing_env",
            hasJobId=bool(job_id),
            hasAppBaseUrl=bool(app_base_url),
            hasWebhookSecret=bool(webhook_secret),
        )
        return 1

    try:
        spec = await _fetch_spec(app_base_url, webhook_secret, job_id)
    except Exception as e:  # noqa: BLE001
        # Nothing to report failure back with yet (no userId/callbackSecret without the
        # spec) — this is a real gap: a job stuck here won't self-report. Logged clearly
        # for now; recovering it needs extending the stuck-job cron sweep (currently only
        # covers status=dispatched/dispatch_pending) to also catch processing/script jobs
        # stuck past a timeout.
        logger.error("job_spec_fetch_failed", jobId=job_id, error=str(e))
        return 1

    try:
        await run_job(spec)
    except Exception:  # noqa: BLE001
        # run_job already reported "failed" via callback before re-raising — this exit
        # code is only for Cloud Run's own execution-history/logging visibility.
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(_main()))
