import os
import threading
import time

from ..logger import logger

# Mounted from a GCS bucket at runtime (Cloud Run volume mount, second-generation
# execution environment) — never downloaded from Hugging Face at process startup or
# baked into the image. Real artifact filenames confirmed against the Lightricks/LTX-2.3
# HF repo listing and DistilledPipeline's actual source: a standalone distilled checkpoint
# (already merged, no extra LoRA needed on top), the matching x2 spatial upsampler
# (confirmed by DistilledPipeline's own docstring: "Stage 2 upsamples by 2x"), and a
# separate Gemma 3-12B text encoder repo.
WEIGHTS_ROOT = os.environ.get("MODEL_WEIGHTS_PATH", "/app/weights")
DISTILLED_CHECKPOINT_PATH = os.path.join(
    WEIGHTS_ROOT, "ltx-2.3-22b-distilled-1.1.safetensors"
)
SPATIAL_UPSAMPLER_PATH = os.path.join(
    WEIGHTS_ROOT, "ltx-2.3-spatial-upscaler-x2-1.1.safetensors"
)
GEMMA_ROOT = os.path.join(WEIGHTS_ROOT, "gemma-3-12b-it-qat-q4_0-unquantized")

_pipeline = None
_pipeline_lock = threading.Lock()


def load_model():
    """Loads the distilled LTX-2.3 pipeline into VRAM once at process start and keeps
    it resident for the life of the instance (Cloud Run scale-to-zero handles idle
    teardown between jobs).

    Constructor signature confirmed against the real DistilledPipeline source
    (Lightricks/LTX-2, packages/ltx-pipelines/src/ltx_pipelines/distilled.py):
    `distilled_checkpoint_path`, `gemma_root`, `spatial_upsampler_path`, `loras`
    (required list — empty here since the checkpoint is already fully distilled,
    no additional LoRA needed on top), plus optional device/quantization/etc.
    """
    global _pipeline
    with _pipeline_lock:
        if _pipeline is not None:
            return _pipeline

        for path in (DISTILLED_CHECKPOINT_PATH, SPATIAL_UPSAMPLER_PATH, GEMMA_ROOT):
            if not os.path.exists(path):
                raise RuntimeError(
                    f"model_weights_not_found:{path} — expected a GCS volume mounted at "
                    f"{WEIGHTS_ROOT}; check the Cloud Run service's Volumes/Volume mounts "
                    "config and that the bucket is actually populated"
                )

        logger.info("model_load_start", weightsRoot=WEIGHTS_ROOT)
        start = time.monotonic()

        from ltx_core.quantization.fp8_cast import build_policy
        from ltx_pipelines.distilled import DistilledPipeline

        # FP8-casts the attention (Q/K/V/out) and feed-forward Linear layers inside each
        # transformer block (confirmed against the real source: ltx_core.quantization.
        # fp8_cast's _FP8_CAST_LINEAR_SUFFIXES) — not the whole model, embeddings/norms/
        # etc. stay bf16. Our checkpoint isn't a prequantized fp8 file (no sibling
        # `*_scale` tensors), so build_policy falls back to naively downcasting those
        # layers rather than using calibrated scales — confirmed real behavior from
        # source, not the README's `QuantizationPolicy.fp8_cast()` (that classmethod
        # doesn't actually exist; this is the real public API).
        quantization = build_policy(DISTILLED_CHECKPOINT_PATH)

        _pipeline = DistilledPipeline(
            distilled_checkpoint_path=DISTILLED_CHECKPOINT_PATH,
            gemma_root=GEMMA_ROOT,
            spatial_upsampler_path=SPATIAL_UPSAMPLER_PATH,
            loras=[],
            quantization=quantization,
        )
        durationMs = int((time.monotonic() - start) * 1000)
        # Real cold-start timing — the only source of this data since Phase 0's GPU
        # validation was skipped; watch this in production instead.
        logger.info("model_load_complete", durationMs=durationMs)
        return _pipeline


def get_model():
    if _pipeline is None:
        return load_model()
    return _pipeline
