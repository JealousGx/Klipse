# syntax=docker/dockerfile:1.6
# Build from the repository root:
#   docker build -f docker/external-video-processor/Dockerfile -t klipse-external-video-processor:latest . \
#     --build-arg WEIGHTS_IMAGE=us-central1-docker.pkg.dev/<PROJECT_ID>/klipse/processor-weights:ltx-2.3-distilled-v1
#
# Runtime: Python 3.12 + CUDA 12.8 + ffmpeg (confirmed real system requirements from
# Lightricks/LTX-2's official repo: Python >=3.12, CUDA >12.7, PyTorch ~=2.7).
#
# Model weights are NOT built inline here — they live in a separately built, rarely
# rebuilt base image (see Dockerfile.weights) referenced via the WEIGHTS_IMAGE build arg.
# This means ordinary app-code changes (this file's runtime stage) never re-trigger the
# 46GB+ weight download — only rebuild/repush Dockerfile.weights when the model version
# or artifacts actually change. Cold-start billing on Cloud Run is instance-lifetime
# based, so a runtime weight fetch would be billed at GPU rates for the whole download
# window — weights are baked in at build time either way, just in a separate image now.

ARG WEIGHTS_IMAGE

FROM ${WEIGHTS_IMAGE} AS weights

# ---

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

COPY --from=weights --chown=app:app /weights /app/weights
COPY --chown=app:app packages/external-video-processor/src ./src

USER app:app

EXPOSE 8790

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
	CMD python3 -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8790/health', timeout=3)" || exit 1

CMD ["python3", "-m", "uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8790"]
