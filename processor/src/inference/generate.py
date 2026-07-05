import asyncio
import os
import random
import tempfile
import time

import torch

from ..logger import logger
from .model import get_model

# Real official default for the two-stage distilled pipeline — confirmed directly from
# Lightricks/LTX-2@a2c3f24078eb918171967f74b6f66b756b29ee45 (the exact commit LTX-Desktop
# itself pins), packages/ltx-pipelines/src/ltx_pipelines/utils/constants.py's
# PipelineParams / LTX_2_3_PARAMS (frame_rate=24.0, unmodified by the LTX-2.3 override,
# which only touches num_inference_steps/stg_blocks) and args.py's
# default_2_stage_distilled_arg_parser, which sources its --frame-rate/--num-frames
# argparse defaults from those same params. The old FRAME_RATE=25.0 here was never
# actually verified against this source despite its comment claiming so.
FRAME_RATE = 24.0

# Real official default num_frames for one generation call (LTX_2_3_PARAMS.num_frames,
# same source as above) — 121 frames @ 24fps ≈ 5.04s. This directly validates ~5s/call as
# the right instinct for segmenting the original ~30s (753-frame) call that reliably OOM'd
# on a 96GB GPU, but uses the literal official frame count rather than re-deriving it via
# our own duration→frames rounding math. See script-generation.server.ts's
# SEGMENT_DURATION_SECONDS, which this must stay in sync with.
NUM_FRAMES_PER_SEGMENT = 121


def _dimensions_for_aspect_ratio(aspect_ratio: str) -> tuple[int, int]:
    """Dimensions rounded to the nearest multiple of 64 — the real two-stage-pipeline
    hard constraint (confirmed via assert_resolution() in ltx_pipelines.utils.helpers:
    two-stage pipelines require divisibility by 64, not 32 — 32 only applies to
    one-stage pipelines, which DistilledPipeline is not) — while staying close to the
    original aspect-ratio targets.
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
    """Runs one independent generation call (NUM_FRAMES_PER_SEGMENT frames, the real
    official default, ~5.04s @ 24fps) and encodes it to a temp .mp4 file. Returns the
    file path — caller is responsible for cleanup.

    Seed is randomized per segment rather than fixed — confirmed via Lightricks' own
    retake_pipeline.py that their real backend treats seed as caller-controlled,
    randomizing only via an explicit sentinel (`seed < 0`) when unspecified, and that
    their continuity mechanism for regenerated content is real video/audio latent
    conditioning from prior content, never seed-matching. Since our continuity instead
    comes from LLM-authored prompt consistency across segments (not frame-conditioning),
    random per-segment seeds matches their own randomize-when-unspecified pattern.
    """
    width, height = _dimensions_for_aspect_ratio(aspect_ratio)
    num_frames = NUM_FRAMES_PER_SEGMENT
    seed = random.randint(0, 2**31 - 1)

    logger.info(
        "segment_generation_start",
        aspectRatio=aspect_ratio,
        numFrames=num_frames,
        seed=seed,
    )
    start = time.monotonic()

    from ltx_core.model.video_vae import TilingConfig, get_video_chunks_number
    from ltx_pipelines.utils.media_io import encode_video

    # Passed into the actual pipeline call (not just used for the encoder's chunk-count
    # bookkeeping below) — confirmed via Lightricks' own LTX-Desktop reference
    # implementation that tiling_config is meant to reach the real generation call, where
    # it splits the VAE decode into smaller spatial/temporal chunks instead of one
    # memory-heavy full-video decode. Previously this was only used for
    # get_video_chunks_number's progress-bar math, never actually applied to generation —
    # a real, missed memory-saving opportunity given how much of today was spent on VRAM.
    tiling_config = TilingConfig.default()

    fd, path = tempfile.mkstemp(suffix=".mp4")
    os.close(fd)

    # @torch.inference_mode() as a function decorator, applied the same way as every
    # real official call site (distilled.py's `@torch.inference_mode() def main()`,
    # LTXFastVideoPipeline's `@torch.inference_mode() def generate(...)`) — and, just as
    # importantly, wrapping the *entire* model-call-through-encode flow in one scope,
    # not just the raw pipeline() call. Tensors produced under inference_mode can't be
    # used in ops tracked by autograd once you leave that scope ("Inference tensors
    # cannot be saved for backward" — confirmed via a real deploy, when encode_video()
    # ran outside inference_mode on the video/audio tensors returned from inside it).
    # LTX-Desktop's real generate() decorates the model call and encode_video_output()
    # together for exactly this reason.
    @torch.inference_mode()
    def _run_pipeline_and_encode():
        video, audio = pipeline(
            prompt=video_prompt,
            seed=seed,
            height=height,
            width=width,
            num_frames=num_frames,
            frame_rate=FRAME_RATE,
            images=[],
            tiling_config=tiling_config,
        )
        encode_video(
            video=video,
            fps=FRAME_RATE,
            audio=audio,
            output_path=path,
            video_chunks_number=get_video_chunks_number(num_frames, tiling_config),
        )

    await asyncio.to_thread(_run_pipeline_and_encode)

    durationMs = int((time.monotonic() - start) * 1000)
    logger.info("segment_generation_complete", durationMs=durationMs)
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
    """Generates each entry in `video_prompts` as its own independent model call
    (NUM_FRAMES_PER_SEGMENT frames each, the real official per-call default), then
    concatenates the resulting clips into one final video. Replaces the old single-call
    approach, which reliably ran out of GPU memory for anything near a full ~30s target
    (confirmed via real deploys) — continuity across segments comes entirely from how
    consistently script_gen's prompts are written (see script-generation.server.ts), not
    from any shared technical state between these calls.
    """
    pipeline = await asyncio.to_thread(get_model)

    # Real official memory-hygiene helper (ltx_pipelines.utils.helpers.cleanup_memory:
    # gc.collect() + torch.cuda.empty_cache() + torch.cuda.synchronize()), used between
    # calls here since we loop through several segments within one job execution —
    # Lightricks' own service processes one request at a time so it doesn't need this
    # between calls, but the underlying helper is theirs, not invented.
    from ltx_pipelines.utils.helpers import cleanup_memory

    segment_paths: list[str] = []
    try:
        for i, prompt in enumerate(video_prompts):
            logger.info(
                "segment_start", index=i, total=len(video_prompts)
            )
            path = await _generate_segment(pipeline, prompt, aspect_ratio)
            segment_paths.append(path)
            logger.info("segment_complete", index=i, total=len(video_prompts))
            await asyncio.to_thread(cleanup_memory)

        return await _concat_segments(segment_paths)
    finally:
        for path in segment_paths:
            if os.path.exists(path):
                os.remove(path)
