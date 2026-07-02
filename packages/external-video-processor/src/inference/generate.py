import random
import tempfile
import time

from ..logger import logger
from .model import get_model

# Confirmed real value from Lightricks/LTX-2's ltx-pipelines example.
FRAME_RATE = 25.0


# LTX-2 hard constraint (confirmed): frame count must be 8n+1.
def _round_to_valid_frame_count(target_duration: int) -> int:
    raw_frames = round(target_duration * FRAME_RATE)
    n = round((raw_frames - 1) / 8)
    return max(8 * n + 1, 9)  # never below the smallest valid value (n=1 -> 9 frames)


async def generate_video(
    *, video_prompt: str, target_duration: int, aspect_ratio: str
) -> bytes:
    """Single generation call — the whole multi-scene video + synchronized audio comes
    back from one model invocation, driven entirely by `video_prompt` (built per the
    LTX-2.3 prompt guide's technique in script_gen.py's system prompt). No chaining,
    no reference-frame conditioning between separate calls.

    Call signature confirmed against DistilledPipeline's real `__call__` source: no
    `negative_prompt` param (unlike the two-stage HQ pipeline's example) — quality/
    unwanted-content control for the distilled pipeline is presumably handled via
    `stage_1_sigmas`/`stage_2_sigmas` defaults, not a negative prompt string.
    `images` is a required param even for pure text-to-video — pass an empty list
    (no image conditioning/reference frames used here).

    Returns (video, audio) SEPARATELY; their own `encode_video` utility handles muxing.
    """
    pipeline = get_model()
    width, height = _dimensions_for_aspect_ratio(aspect_ratio)
    num_frames = _round_to_valid_frame_count(target_duration)
    seed = random.randint(0, 2**31 - 1)

    logger.info(
        "video_generation_start",
        targetDuration=target_duration,
        aspectRatio=aspect_ratio,
        numFrames=num_frames,
        seed=seed,
    )
    start = time.monotonic()

    video, audio = pipeline(
        prompt=video_prompt,
        seed=seed,
        height=height,
        width=width,
        num_frames=num_frames,
        frame_rate=FRAME_RATE,
        images=[],
    )

    generationDurationMs = int((time.monotonic() - start) * 1000)
    logger.info("video_generation_complete", durationMs=generationDurationMs)

    from ltx_core.model.video_vae import TilingConfig, get_video_chunks_number
    from ltx_pipelines.utils.media_io import encode_video

    with tempfile.NamedTemporaryFile(suffix=".mp4") as out_f:
        encode_video(
            video=video,
            fps=FRAME_RATE,
            audio=audio,
            output_path=out_f.name,
            video_chunks_number=get_video_chunks_number(
                num_frames, TilingConfig.default()
            ),
        )
        with open(out_f.name, "rb") as f:
            return f.read()


def _dimensions_for_aspect_ratio(aspect_ratio: str) -> tuple[int, int]:
    """Dimensions rounded to the nearest multiple of 32 (hard constraint) while staying
    close to the original aspect-ratio targets.
    """
    return {
        "16:9": (1280, 704),
        "9:16": (704, 1280),
        "1:1": (1088, 1088),
    }.get(aspect_ratio, (704, 1280))
