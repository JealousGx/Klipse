from typing import Literal

import httpx

from .logger import logger
from .retry import NonRetriableError, with_retries

Stage = Literal["script", "video_gen"]


def _headers(callback_secret: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {callback_secret}",
        "Content-Type": "application/json",
    }


async def _post(url: str, callback_secret: str, body: dict, attempts: int) -> None:
    async def attempt(_: int) -> None:
        async with httpx.AsyncClient(timeout=30) as client:
            res = await client.post(url, headers=_headers(callback_secret), json=body)
            if res.status_code >= 400 and res.status_code < 500 and res.status_code != 409:
                # 409 (idempotent replay) is treated as success by the caller, not raised here.
                raise NonRetriableError(f"callback_failed:{res.status_code}:{res.text[:200]}")
            if res.status_code >= 500:
                raise RuntimeError(f"callback_failed:{res.status_code}:{res.text[:200]}")

    await with_retries("callback_post", attempts, attempt)


async def report_progress(
    callback_base_url: str, callback_secret: str, job_id: str, stage: Stage, progress: int
) -> None:
    """Best-effort — errors are logged as warnings, not raised (mirrors old reportProgress)."""
    try:
        await _post(
            f"{callback_base_url}/api/internal/processor/progress",
            callback_secret,
            {"jobId": job_id, "stage": stage, "progress": progress},
            attempts=3,
        )
    except Exception as e:  # noqa: BLE001
        logger.warning("report_progress_failed", jobId=job_id, error=str(e))


async def report_key_failure(
    callback_base_url: str,
    callback_secret: str,
    job_id: str,
    provider: Literal["openrouter", "gemini"],
    key_id: str,
    http_status: int,
    body_snippet: str,
    retry_after_header: str | None,
) -> None:
    """Best-effort — errors are logged as warnings, not raised (mirrors old reportKeyFailure)."""
    try:
        await _post(
            f"{callback_base_url}/api/internal/processor/key-failure",
            callback_secret,
            {
                "jobId": job_id,
                "provider": provider,
                "keyId": key_id,
                "httpStatus": http_status,
                "bodySnippet": body_snippet[:800],
                "retryAfterHeader": retry_after_header,
            },
            attempts=5,
        )
    except Exception as e:  # noqa: BLE001
        logger.warning("report_key_failure_failed", jobId=job_id, error=str(e))


async def report_complete(
    callback_base_url: str,
    callback_secret: str,
    job_id: str,
    user_id: str,
    status: Literal["completed", "failed"],
    error: str | None = None,
    script_text: str | None = None,
    title: str | None = None,
    description: str | None = None,
    tags: list[str] | None = None,
    duration_sec: int | None = None,
) -> None:
    """Terminal callback — raises on final failure (matches old reportComplete, this is a
    must-deliver operation, unlike progress/key-failure which are best-effort).
    """
    body = {
        "jobId": job_id,
        "userId": user_id,
        "status": status,
        "error": error,
        "scriptText": script_text,
        "title": title,
        "description": description,
        "tags": tags,
        "durationSec": duration_sec,
    }
    await _post(
        f"{callback_base_url}/api/internal/video-processor/assembly-complete",
        callback_secret,
        {k: v for k, v in body.items() if v is not None},
        attempts=8,
    )
