import logging
import os
import threading

logger = logging.getLogger("processor")

# Baked into the container image at build time (Phase 5 hard requirement) — never
# downloaded from Hugging Face at process startup. Real artifact filenames confirmed
# against the Lightricks/LTX-2.3 HF repo listing and DistilledPipeline's actual source:
# a standalone distilled checkpoint (already merged, no extra LoRA needed on top), the
# matching x2 spatial upsampler (confirmed by DistilledPipeline's own docstring: "Stage 2
# upsamples by 2x"), and a separate Gemma 3-12B text encoder repo.
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
                    f"model_weights_not_found:{path} — weights must be baked into the "
                    "image at build time, not fetched at runtime"
                )

        logger.info("model_load_start", extra={"weightsRoot": WEIGHTS_ROOT})

        from ltx_pipelines.distilled import DistilledPipeline

        _pipeline = DistilledPipeline(
            distilled_checkpoint_path=DISTILLED_CHECKPOINT_PATH,
            gemma_root=GEMMA_ROOT,
            spatial_upsampler_path=SPATIAL_UPSAMPLER_PATH,
            loras=[],
        )
        logger.info("model_load_complete")
        return _pipeline


def get_model():
    if _pipeline is None:
        return load_model()
    return _pipeline
