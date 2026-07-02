# syntax=docker/dockerfile:1.6
# Build from the repository root:
#   docker build -f docker/external-video-processor/Dockerfile -t klipse-external-video-processor:latest .
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

ENV PORT=8790 \
	MODEL_WEIGHTS_PATH=/app/weights \
	PYTHONUNBUFFERED=1

COPY packages/external-video-processor/requirements.txt ./requirements.txt
# --default-timeout + --retries: torch's wheel is large and a plain pip install can hit
# a read timeout downloading it (confirmed via a local smoke-test build).
# --break-system-packages: ubuntu24.04's pip enforces PEP 668 (externally-managed-
# environment) by default, blocking plain `pip install` outside a venv. Safe to override
# here — this is an isolated single-purpose container, not a shared system Python.
RUN pip3 install --no-cache-dir --default-timeout=300 --retries=5 --break-system-packages -r requirements.txt

COPY --chown=app:app packages/external-video-processor/src ./src

# /app/weights is intentionally NOT created/populated here — it's an empty mount point
# that Cloud Run's GCS volume mount fills at container start. Locally (docker-compose,
# no volume mount available), this directory will be empty — real generation requires
# either a local GCS FUSE mount or running against the deployed Cloud Run service; API/
# plumbing-only local testing without real weights still works via mock mode / running
# uvicorn directly (see docs/video-processor.md).
RUN mkdir -p /app/weights && chown app:app /app/weights

USER app:app

EXPOSE 8790

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
	CMD python3 -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8790/health', timeout=3)" || exit 1

CMD ["python3", "-m", "uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8790"]
