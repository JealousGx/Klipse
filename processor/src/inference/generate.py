import asyncio
import os
import random
import tempfile
import time

from ..logger import logger
from .model import get_model

# Confirmed real value from Lightricks/LTX-2's ltx-pipelines example.
FRAME_RATE = 25.0

# Matches Lightricks' own documented/tested default for the two-stage distilled pipeline
# (~121 frames at 24fps in their reference example) — the widest safety margin against
# the VRAM ceiling of any duration actually confirmed to work. A single un-segmented ~30s
# call (753 frames) reliably OOMs on a 96GB GPU (confirmed via real deploys); this is why
# generation is segmented at all — see script-generation.server.ts's SEGMENT_DURATION_SECONDS,
# which this must stay in sync with.
SEGMENT_DURATION_SECONDS = 5


# LTX-2 hard constraint (confirmed): frame count must be 8n+1.
def _round_to_valid_frame_count(target_duration: float) -> int:
    raw_frames = round(target_duration * FRAME_RATE)
    n = round((raw_frames - 1) / 8)
    return max(8 * n + 1, 9)  # never below the smallest valid value (n=1 -> 9 frames)


def _dimensions_for_aspect_ratio(aspect_ratio: str) -> tuple[int, int]:
    """Dimensions rounded to the nearest multiple of 32 (hard constraint) while staying
    close to the original aspect-ratio targets.
    """
    return {
        "16:9": (1280, 704),
        "9:16": (704, 1280),
        "1:1": (1088, 1088),
    }.get(aspect_ratio, (704, 1280))


async def _generate_segment(
    pipeline,
    video_prompt: str,
    aspect_ratio: str,
) -> str:
    """Runs one independent generation call (~5s, SEGMENT_DURATION_SECONDS) and encodes
    it to a temp .mp4 file. Returns the file path — caller is responsible for cleanup.
    """
    width, height = _dimensions_for_aspect_ratio(aspect_ratio)
    num_frames = _round_to_valid_frame_count(SEGMENT_DURATION_SECONDS)
    seed = random.randint(0, 2**31 - 1)

    logger.info(
        "segment_generation_start",
        aspectRatio=aspect_ratio,
        numFrames=num_frames,
        seed=seed,
    )
    start = time.monotonic()

    video, audio = await asyncio.to_thread(
        lambda: pipeline(
            prompt=video_prompt,
            seed=seed,
            height=height,
            width=width,
            num_frames=num_frames,
            frame_rate=FRAME_RATE,
            images=[],
        )
    )

    durationMs = int((time.monotonic() - start) * 1000)
    logger.info("segment_generation_complete", durationMs=durationMs)

    from ltx_core.model.video_vae import TilingConfig, get_video_chunks_number
    from ltx_pipelines.utils.media_io import encode_video

    fd, path = tempfile.mkstemp(suffix=".mp4")
    os.close(fd)
    await asyncio.to_thread(
        lambda: encode_video(
            video=video,
            fps=FRAME_RATE,
            audio=audio,
            output_path=path,
            video_chunks_number=get_video_chunks_number(num_frames, TilingConfig.default()),
        )
    )
    return path


async def _concat_segments(segment_paths: list[str]) -> bytes:
    """Concatenates already-encoded segment clips into one file via ffmpeg's concat
    demuxer (stream copy, no re-encode — safe here since every segment was produced by
    the same pipeline call with identical codec/resolution/fps settings).
    """
    if len(segment_paths) == 1:
        with open(segment_paths[0], "rb") as f:
            return f.read()

    fd, list_path = tempfile.mkstemp(suffix=".txt")
    fd_out, out_path = tempfile.mkstemp(suffix=".mp4")
    os.close(fd_out)
    try:
        with os.fdopen(fd, "w") as f:
            for path in segment_paths:
                # ffmpeg concat-file syntax requires single-quoted paths with any
                # embedded single quotes escaped — temp paths never contain one, but
                # escaping defensively costs nothing.
                escaped = path.replace("'", "'\\''")
                f.write(f"file '{escaped}'\n")

        proc = await asyncio.create_subprocess_exec(
            "ffmpeg",
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            list_path,
            "-c",
            "copy",
            out_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await proc.communicate()
        if proc.returncode != 0:
            err = stderr.decode(errors="replace")[:500]
            logger.error("segment_concat_failed", error=err, returncode=proc.returncode)
            raise RuntimeError(f"ffmpeg_concat_failed:{err}")

        with open(out_path, "rb") as f:
            return f.read()
    finally:
        os.remove(list_path)
        if os.path.exists(out_path):
            os.remove(out_path)


async def generate_video(
    *, video_prompts: list[str], aspect_ratio: str
) -> bytes:
    """Generates each entry in `video_prompts` as its own independent model call (~5s
    each — SEGMENT_DURATION_SECONDS, the model's own tested-safe default), then
    concatenates the resulting clips into one final video. Replaces the old single-call
    approach, which reliably ran out of GPU memory for anything near a full ~30s target
    (confirmed via real deploys) — continuity across segments comes entirely from how
    consistently script_gen's prompts are written (see script-generation.server.ts), not
    from any shared technical state between these calls.
    """
    pipeline = await asyncio.to_thread(get_model)

    segment_paths: list[str] = []
    try:
        for i, prompt in enumerate(video_prompts):
            logger.info(
                "segment_start", index=i, total=len(video_prompts)
            )
            path = await _generate_segment(pipeline, prompt, aspect_ratio)
            segment_paths.append(path)
            logger.info("segment_complete", index=i, total=len(video_prompts))

        return await _concat_segments(segment_paths)
    finally:
        for path in segment_paths:
            if os.path.exists(path):
                os.remove(path)
