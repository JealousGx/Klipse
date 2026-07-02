import asyncio
import time
from collections import OrderedDict

from fastapi import Depends, FastAPI
from pydantic import BaseModel

from .auth import require_bearer_auth
from .callbacks import report_complete, report_progress
from .inference.generate import generate_video
from .logger import logger
from .r2_upload import upload_bytes_to_presigned_url
from .script_gen import ProviderKey, generate_script
from .watermark import apply_watermark_with_audio

app = FastAPI()

MAX_FINISHED_JOB_IDS = 2000


# ---------------------------------------------------------------------------
# Request schema — mirrors packages/video-assembly-shared/src/processor-spec.ts's
# ProcessorJobSpec exactly (script-gen keys only; no TTS/image/sound fields).
# ---------------------------------------------------------------------------


class ProcessorProviderKeyIn(BaseModel):
    id: str
    secret: str
    modelId: str | None = None


class ProcessorProviderKeysIn(BaseModel):
    openrouter: list[ProcessorProviderKeyIn]
    gemini: list[ProcessorProviderKeyIn]


class ProcessorPresignedUrlsIn(BaseModel):
    outputVideo: str


class ProcessorJobSpecIn(BaseModel):
    jobId: str
    userId: str
    channelId: str
    scriptSystemPrompt: str
    scriptUserPrompt: str
    openrouterScriptModels: list[str]
    targetDuration: int
    aspectRatio: str
    freeTierWatermark: bool
    watermarkLabel: str
    providerKeys: ProcessorProviderKeysIn
    presignedUrls: ProcessorPresignedUrlsIn
    callbackBaseUrl: str
    callbackSecret: str


# ---------------------------------------------------------------------------
# Serial single-worker queue + idempotency tracking — mirrors the old runner.ts's
# specQueue/finishedSpecJobIds/activeSpecJobIds pattern, kept in-process since Cloud
# Run concurrency for this service is set to 1 (Phase 5 hard requirement).
# ---------------------------------------------------------------------------

_active_job_ids: set[str] = set()
_finished_job_ids: "OrderedDict[str, None]" = OrderedDict()
_queue: "asyncio.Queue[ProcessorJobSpecIn]" = asyncio.Queue()
_worker_started = False


def _mark_finished(job_id: str) -> None:
    _finished_job_ids[job_id] = None
    if len(_finished_job_ids) > MAX_FINISHED_JOB_IDS:
        _finished_job_ids.popitem(last=False)


async def _worker_loop() -> None:
    while True:
        spec = await _queue.get()
        try:
            await _run_job(spec)
        except Exception as e:  # noqa: BLE001
            logger.error("job_failed", jobId=spec.jobId, error=str(e))
        finally:
            _active_job_ids.discard(spec.jobId)
            _mark_finished(spec.jobId)
            _queue.task_done()


def _ensure_worker_started() -> None:
    global _worker_started
    if not _worker_started:
        asyncio.create_task(_worker_loop())
        _worker_started = True


async def _run_job(spec: ProcessorJobSpecIn) -> None:
    job_id = spec.jobId
    base_url = spec.callbackBaseUrl
    secret = spec.callbackSecret
    start = time.monotonic()

    logger.info("job_start", jobId=job_id, channelId=spec.channelId, userId=spec.userId)

    try:
        await report_progress(base_url, secret, job_id, "script", 5)

        openrouter_keys = [
            ProviderKey(id=k.id, secret=k.secret, model_id=k.modelId)
            for k in spec.providerKeys.openrouter
        ]
        gemini_keys = [
            ProviderKey(id=k.id, secret=k.secret, model_id=k.modelId)
            for k in spec.providerKeys.gemini
        ]

        script = await generate_script(
            job_id=job_id,
            callback_base_url=base_url,
            callback_secret=secret,
            system_prompt=spec.scriptSystemPrompt,
            user_prompt=spec.scriptUserPrompt,
            model_chain=spec.openrouterScriptModels,
            openrouter_keys=openrouter_keys,
            gemini_keys=gemini_keys,
        )
        await report_progress(base_url, secret, job_id, "script", 100)

        await report_progress(base_url, secret, job_id, "video_gen", 10)
        video_bytes = await generate_video(
            video_prompt=script.video_prompt,
            target_duration=spec.targetDuration,
            aspect_ratio=spec.aspectRatio,
        )
        await report_progress(base_url, secret, job_id, "video_gen", 80)

        final_bytes = video_bytes
        if spec.freeTierWatermark:
            import tempfile

            with tempfile.NamedTemporaryFile(suffix=".mp4") as in_f, tempfile.NamedTemporaryFile(
                suffix=".mp4"
            ) as out_f:
                in_f.write(video_bytes)
                in_f.flush()
                await apply_watermark_with_audio(in_f.name, out_f.name, spec.watermarkLabel)
                with open(out_f.name, "rb") as f:
                    final_bytes = f.read()

        await upload_bytes_to_presigned_url(spec.presignedUrls.outputVideo, final_bytes)
        await report_progress(base_url, secret, job_id, "video_gen", 100)

        await report_complete(
            base_url,
            secret,
            job_id,
            spec.userId,
            "completed",
            script_text=script.video_prompt,
            title=script.title,
            description=script.description,
            tags=script.tags,
        )
        durationMs = int((time.monotonic() - start) * 1000)
        logger.info("job_complete", jobId=job_id, durationMs=durationMs)
    except Exception as e:  # noqa: BLE001
        durationMs = int((time.monotonic() - start) * 1000)
        logger.error("job_error", jobId=job_id, durationMs=durationMs, error=str(e))
        try:
            await report_complete(
                base_url, secret, job_id, spec.userId, "failed", error=str(e)
            )
        except Exception as callback_error:  # noqa: BLE001
            logger.error(
                "job_error_callback_failed", jobId=job_id, error=str(callback_error)
            )
        raise


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.get("/health")
async def health() -> dict:
    """Liveness/startup probe — deliberately does not touch the model/VRAM, so
    Cloud Run's health checks don't force a cold-start load before real traffic arrives.
    """
    return {"ok": True}


@app.post("/v1/process-spec", dependencies=[Depends(require_bearer_auth)])
async def process_spec(spec: ProcessorJobSpecIn) -> dict:
    _ensure_worker_started()

    if spec.jobId in _finished_job_ids:
        return {"accepted": True, "idempotent": True}
    if spec.jobId in _active_job_ids:
        return {"accepted": True, "idempotent": True}

    _active_job_ids.add(spec.jobId)
    await _queue.put(spec)
    return {"accepted": True}
