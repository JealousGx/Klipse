# syntax=docker/dockerfile:1.6
# Build with processor/ as the context:
#   docker build -f processor/Dockerfile -t klipse-external-video-processor:latest processor/
#
# Runtime: Python 3.12 + CUDA 12.8 + ffmpeg (confirmed real system requirements from
# Lightricks/LTX-2's official repo: Python >=3.12, CUDA >12.7, PyTorch ~=2.7).
#
# Model weights are NOT baked into this image at all — they're mounted at runtime from a
# GCS bucket (Cloud Run second-generation execution environment's native Cloud Storage
# volume mount support), populated once via cloudbuild-weights-to-gcs.yaml. This replaces
# the earlier baked-in-image approach (Dockerfile.weights + WEIGHTS_IMAGE build arg),
# which required pulling and extracting a 56GB+ image layer on every single app-code
# build — a real, recurring cost that a runtime mount avoids entirely. MODEL_WEIGHTS_PATH
# below must match the container path the GCS volume is mounted at in the Cloud Run
# console (Volumes + Volume mounts settings).

FROM nvidia/cuda:12.8.0-runtime-ubuntu24.04 AS runner

# ubuntu22.04 (Jammy)'s default apt repos only ship Python 3.10 — 3.12 isn't available
# without a PPA. Using ubuntu24.04 (Noble) instead, which ships 3.12 natively (confirmed
# real published tag: nvidia/cuda:12.8.0-runtime-ubuntu24.04).
RUN apt-get update && apt-get install -y --no-install-recommends \
	python3.12 python3-pip ffmpeg fonts-dejavu-core git \
	&& rm -rf /var/lib/apt/lists/* \
	&& groupadd -g 65532 app \
	&& useradd -u 65532 -g app -M app

WORKDIR /app

ENV MODEL_WEIGHTS_PATH=/app/weights \
	PYTHONUNBUFFERED=1

COPY requirements.txt ./requirements.txt
# --default-timeout + --retries: torch's wheel is large and a plain pip install can hit
# a read timeout downloading it (confirmed via a local smoke-test build).
# --break-system-packages: ubuntu24.04's pip enforces PEP 668 (externally-managed-
# environment) by default, blocking plain `pip install` outside a venv. Safe to override
# here — this is an isolated single-purpose container, not a shared system Python.
#
# torch + torchaudio + torchvision installed first, together, from PyTorch's own cu128
# index (bundles a fixed, matching set of nvidia-cuda-*-cu12 runtime libs for this image's
# CUDA 12.8 base). All three must be pinned here: ltx-core's own pyproject.toml
# (github.com/Lightricks/LTX-2) depends on `torch~=2.7` (pinned) but bare, unpinned
# `torchaudio` — and neither torch nor torchaudio nor torchvision (a transitive need of
# `transformers`' AutoImageProcessor) is routed to a CUDA-specific index in ltx-core's own
# [tool.uv.sources] (only xformers/tensorrt-llm are). So `pip install -r requirements.txt`
# below would otherwise resolve them from plain PyPI at whatever's newest, independent of
# each other — confirmed via real deploys this drifted to a CUDA 13-tagged torchaudio next
# to a CUDA 12.8 torch (broke `libcudart.so` loading), and separately left torchvision
# missing entirely (transformers' AutoImageProcessor requires it, nothing in
# requirements.txt pulled it in). torchvision==0.22.0 is the version PyTorch's official
# compatibility matrix pairs with torch==2.7.0.
RUN pip3 install --no-cache-dir --default-timeout=300 --retries=5 --break-system-packages \
	torch==2.7.0 torchaudio==2.7.0 torchvision==0.22.0 --index-url https://download.pytorch.org/whl/cu128 \
	&& pip3 install --no-cache-dir --default-timeout=300 --retries=5 --break-system-packages -r requirements.txt

COPY --chown=app:app src ./src

# /app/weights is intentionally NOT created/populated here — it's an empty mount point
# that Cloud Run's GCS volume mount fills at container start. Locally (docker-compose,
# no volume mount available), this directory will be empty — real generation requires
# either a local GCS FUSE mount or running against the deployed Cloud Run Job (see
# docs/video-processor.md).
RUN mkdir -p /app/weights && chown app:app /app/weights

# torch.compile's Inductor cache (and Triton's kernel cache) write under $HOME by
# default. The app user is created with `useradd -M` (no home directory, deliberately —
# it's a single-purpose service account) so $HOME resolves to a nonexistent /home/app,
# and those writes fail with a permission error partway through generation (confirmed via
# a real deploy: a lazy-compiled second shape triggered the write, failing ~33 minutes
# in, not immediately). Point HOME at a real, explicitly-owned directory instead — set
# here (not earlier, alongside MODEL_WEIGHTS_PATH) so it only affects the runtime
# container process, not the earlier root-run pip/git build steps above, which would
# otherwise see a $HOME that doesn't exist yet at that point in the build.
RUN mkdir -p /app/cache && chown app:app /app/cache
ENV HOME=/app/cache \
	TORCHINDUCTOR_CACHE_DIR=/app/cache/torchinductor \
	TRITON_CACHE_DIR=/app/cache/triton

USER app:app

# No HTTP surface at all — this runs as a Cloud Run Job, not a Service: one execution
# processes one video_jobs row (KLIPSE_JOB_ID env override) then exits. Cloud Run tracks
# the process exit code directly, no health-check probe needed.
CMD ["python3", "-m", "src.job_main"]
