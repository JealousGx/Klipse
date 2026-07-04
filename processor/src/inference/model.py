import os
import threading
import time

import torch

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

# --- SageAttention ---------------------------------------------------------------
# Ported verbatim (pattern-for-pattern) from Lightricks' own production server
# (Lightricks/LTX-Desktop, backend/ltx2_server.py) — SageAttention is a real, officially
# declared dependency of their shipped product (backend/pyproject.toml:
# `sageattention>=1.0.0; sys_platform != 'darwin'`) and is enabled BY DEFAULT there
# (`USE_SAGE_ATTENTION` env var defaults to "1"). It replaces the standard
# scaled_dot_product_attention with a quantized-attention kernel for supported head
# dimensions, with the same graceful two-layer fallback their server uses: if the
# package isn't installed, or fails at runtime for an unsupported shape/GPU, attention
# silently falls back to plain SDPA — never breaks a job.
_USE_SAGE_ATTENTION = os.environ.get("USE_SAGE_ATTENTION", "1") == "1"
_SAGE_SUPPORTED_HEADDIMS = {64, 96, 128}
_sage_runtime_fallback_logged = False


def _enable_sage_attention() -> None:
    global _sage_runtime_fallback_logged

    import torch.nn.functional as F

    try:
        from sageattention import sageattn
    except ImportError:
        logger.warn("sage_attention_not_installed")
        return

    _original_sdpa = F.scaled_dot_product_attention

    def _patched_sdpa(query, key, value, attn_mask=None, dropout_p=0.0, is_causal=False, **kwargs):
        try:
            if (
                attn_mask is None
                and dropout_p == 0.0
                and query.is_cuda
                and query.shape[-1] in _SAGE_SUPPORTED_HEADDIMS
            ):
                return sageattn(query, key, value, is_causal=is_causal, tensor_layout="HND")
        except Exception:  # noqa: BLE001
            if not _sage_runtime_fallback_logged:
                logger.warn("sage_attention_runtime_fallback")
                _sage_runtime_fallback_logged = True
        return _original_sdpa(query, key, value, attn_mask=attn_mask, dropout_p=dropout_p, is_causal=is_causal)

    F.scaled_dot_product_attention = _patched_sdpa
    logger.info("sage_attention_enabled")


if _USE_SAGE_ATTENTION:
    try:
        _enable_sage_attention()
    except Exception as e:  # noqa: BLE001
        logger.warn("sage_attention_setup_failed", error=str(e))

# Matches Lightricks' own LTX-Desktop reference implementation's warmup() method
# (backend/services/fast_video_pipeline/ltx_fast_video_pipeline.py) — a tiny, cheap,
# throwaway generation run immediately after loading, before any real job. This absorbs
# CUDA kernel JIT overhead on a fast dummy call instead of the real first segment.
_WARMUP_FRAMES = 9
_WARMUP_HEIGHT = 256
_WARMUP_WIDTH = 384
_WARMUP_FRAME_RATE = 8.0


def _warmup(pipeline) -> None:
    logger.info("model_warmup_start")
    start = time.monotonic()
    try:
        pipeline(
            prompt="test warmup",
            seed=42,
            height=_WARMUP_HEIGHT,
            width=_WARMUP_WIDTH,
            num_frames=_WARMUP_FRAMES,
            frame_rate=_WARMUP_FRAME_RATE,
            images=[],
        )
        durationMs = int((time.monotonic() - start) * 1000)
        logger.info("model_warmup_complete", durationMs=durationMs)
    except Exception as e:  # noqa: BLE001
        # Warmup is a pure performance optimization, not correctness-critical — if it
        # fails for some reason, real generation should still proceed (just without the
        # warm-kernel benefit), not take the whole job down with it.
        durationMs = int((time.monotonic() - start) * 1000)
        logger.error("model_warmup_failed", durationMs=durationMs, error=str(e))


def load_model():
    """Loads the distilled LTX-2.3 pipeline into VRAM once at process start and keeps
    it resident for the life of the instance (Cloud Run scale-to-zero handles idle
    teardown between jobs).

    Constructor signature and defaults confirmed against the real DistilledPipeline
    source at the exact commit Lightricks' own LTX-Desktop pins
    (Lightricks/LTX-2@a2c3f24078eb918171967f74b6f66b756b29ee45,
    packages/ltx-pipelines/src/ltx_pipelines/distilled.py): `distilled_checkpoint_path`,
    `gemma_root`, `spatial_upsampler_path`, `loras` (required list — empty here since the
    checkpoint is already fully distilled), `device`, `quantization`, `registry`,
    `torch_compile: bool` (NOT a `compilation_config`/`CompilationConfig` object — that
    only exists on the `main` branch, which has diverged from this pinned commit).
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

        # Import order matters here: `ltx_pipelines.distilled` must be imported before
        # `ltx_core.quantization` (real, confirmed circular-import bug in ltx-core at
        # this commit). `ltx_core.quantization.fp8_cast` does
        # `from ltx_core.loader.module_ops import ModuleOps`, which — if `ltx_core.loader`
        # hasn't been imported yet — triggers `ltx_core/loader/__init__.py`, whose first
        # line is `from ltx_core.loader.fuse_loras import apply_loras`, and
        # `fuse_loras.py` does `from ltx_core.quantization.fp8_cast import
        # _fused_add_round_launch` — re-entering `fp8_cast` while it's still mid-import
        # (before that name is even defined), raising exactly the
        # "partially initialized module" ImportError seen in a real deploy.
        # `ltx_pipelines.distilled` itself imports `ltx_core.loader` (for
        # `LoraPathStrengthAndSDOps`) before its own `ltx_core.quantization` import, so
        # importing it first here means `ltx_core.loader` is already fully cached in
        # `sys.modules` by the time anything touches `fp8_cast.py` — no re-entrant
        # partial import. LTX-Desktop's own code imports in the problem order
        # (`QuantizationPolicy` first) but never hits this, only because its much larger
        # app has already imported `ltx_core.loader` for some other service by the time
        # that code runs — we're the first thing in our process to touch `ltx_core` at
        # all, so we hit the raw bug unless we control the order ourselves.
        from ltx_pipelines.distilled import DistilledPipeline
        from ltx_core.quantization import QuantizationPolicy

        device = torch.device("cuda", torch.cuda.current_device()) if torch.cuda.is_available() else torch.device("cpu")

        # FP8: matches Lightricks' own real default (LTX-Desktop's
        # LTXFastVideoPipeline.__init__: `QuantizationPolicy.fp8_cast() if
        # device_supports_fp8(device) else None` — device_supports_fp8 is just
        # `device.type == "cuda"` in their own services_utils.py, which lives in their
        # app code, not in ltx-core/ltx-pipelines, so inlined here rather than imported
        # from a package we don't install). Applied unconditionally on any CUDA device.
        # Confirmed via the real fp8_cast.py source that this only downcasts a narrow
        # set of transformer-block Linear layers to fp8 storage and upcasts back to bf16
        # on every forward pass (UPCAST_DURING_INFERENCE) — bf16-equivalent numerics, no
        # peak-VRAM benefit for our checkpoint (confirmed empirically earlier against
        # the same underlying behavior via a different, main-branch-only API), but zero
        # downside either, so there's no reason to diverge from their unconditional
        # default just because it doesn't move our VRAM ceiling.
        quantization = QuantizationPolicy.fp8_cast() if device.type == "cuda" else None

        # torch_compile=False: Lightricks' own real production server
        # (backend/ltx2_server.py) never enables this at startup — compilation is a
        # separate, deliberate, opt-in step there (LTXFastVideoPipeline.
        # compile_transformer(), which *reconstructs* the pipeline with
        # torch_compile=True), never paired with warmup unconditionally on arbitrary
        # hardware. Enabling it here previously caused a 92GB+ CUDA OOM on a trivial
        # 9-frame warmup call (CUDA graph capture reserves large static VRAM for a
        # 22B-param model near-independent of input size) — this default (off) matches
        # their real production behavior, not just a workaround for that crash.
        _pipeline = DistilledPipeline(
            distilled_checkpoint_path=DISTILLED_CHECKPOINT_PATH,
            gemma_root=GEMMA_ROOT,
            spatial_upsampler_path=SPATIAL_UPSAMPLER_PATH,
            loras=[],
            device=device,
            quantization=quantization,
            torch_compile=False,
        )
        durationMs = int((time.monotonic() - start) * 1000)
        # Real cold-start timing — the only source of this data since Phase 0's GPU
        # validation was skipped; watch this in production instead.
        logger.info("model_load_complete", durationMs=durationMs)

        _warmup(_pipeline)
        return _pipeline


def get_model():
    if _pipeline is None:
        return load_model()
    return _pipeline
