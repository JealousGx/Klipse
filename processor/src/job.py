import tempfile
import time

from pydantic import BaseModel

from .callbacks import report_complete, report_progress
from .inference.generate import generate_video
from .logger import logger
from .r2_upload import upload_bytes_to_presigned_url
from .script_gen import ProviderKey, generate_script
from .watermark import apply_watermark_with_audio

# ---------------------------------------------------------------------------
# Spec schema — mirrors packages/video-assembly-shared/src/processor-spec.ts's
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


async def run_job(spec: ProcessorJobSpecIn) -> None:
    """Script gen -> single-call video+audio generation -> watermark -> R2 upload ->
    callback. One Cloud Run Job execution runs exactly one call of this, start to finish
    — no queue/worker needed (that only existed to serialize work within a single
    long-lived Service instance, which Jobs replace entirely).
    """
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
