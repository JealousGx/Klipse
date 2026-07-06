# syntax=docker/dockerfile:1.6
# Build with processor/ as the context:
#   docker build -f processor/Dockerfile -t klipse-external-video-processor:latest processor/
#
# Runtime: Python 3.12 + CUDA 12.8 + ffmpeg (confirmed real system requirements from
# Lightricks/LTX-2's official repo: Python >=3.12, CUDA >12.7). Exact PyTorch/transformers/
# triton versions below match the tested lockfile for the specific commit we pin in
# requirements.txt (a2c3f24078eb918171967f74b6f66b756b29ee45 — the same commit Lightricks'
# own LTX-Desktop product pins), not the repo's own loose `torch~=2.7` declared constraint.
#
# Model weights ARE baked into this image (downloaded directly from Hugging Face during
# the build — see the weights RUN step below). This replaces an earlier runtime-mount
# approach (GCS volume mount, populated via cloudbuild-weights-to-gcs.yaml): real deploys
# confirmed the GCS FUSE mount was satisfying reads lazily/on-demand rather than eagerly
# loading everything upfront, causing a ~30min stall on every single job's first forward
# pass (Google's own docs confirm large sequential reads over Cloud Storage FUSE are
# network-bandwidth-limited, and recommend baking models into the image instead — this
# switches back to that recommendation). The weights RUN step is placed early (before
# COPY src, after system deps) so it only re-executes when the weights step's own content
# changes (i.e. when we bump the model version) — ordinary code-only pushes hit Docker's
# layer cache and never re-download anything.


# devel, not runtime: NVIDIA's own documented distinction is that "runtime" images only
# add the CUDA shared libraries, while "devel" adds the compiler toolchain, headers, and
# static libraries needed to compile CUDA applications from source. torch_compile is off
# by default now (see inference/model.py — matches Lightricks' own production server,
# which never enables it at startup either), but SageAttention ships as a compiled CUDA
# extension that needs building against this toolchain at pip-install time, and Triton
# (an explicit dependency, used internally by SageAttention/ltx-core) still JIT-compiles
# its own native helpers at runtime regardless of torch.compile — confirmed real published
# tag: nvidia/cuda:12.8.0-devel-ubuntu24.04.
FROM nvidia/cuda:12.8.0-devel-ubuntu24.04 AS runner

# ubuntu22.04 (Jammy)'s default apt repos only ship Python 3.10 — 3.12 isn't available
# without a PPA. Using ubuntu24.04 (Noble) instead, which ships 3.12 natively.
#
# build-essential (gcc/g++/make): needed to build SageAttention's CUDA extension and for
# Triton's own JIT-compiled native helpers (see above). Without this (and without the
# devel base image above), an earlier attempt at enabling torch.compile's Inductor backend
# ran for ~30 minutes before failing with "RuntimeError: Failed to find C compiler" the
# moment it tried to compile something — confirmed via a real deploy. Kept even with
# torch.compile off by default, since SageAttention/Triton have the same real toolchain
# requirement independent of that setting.
# libomp-dev: defensive addition against a separate, real, documented C++ compile failure
# ("fatal error: 'omp.h' file not found") reported in container environments for
# Triton-adjacent native builds — standard Ubuntu gcc/g++ (from build-essential) normally
# bundles OpenMP support already, but this is cheap insurance given how costly each failed
# iteration has been so far.
# python3.12-dev: Triton compiles its own C extensions (e.g. cuda_utils.c) against
# Python.h at runtime — the plain python3.12/python3-pip packages only provide the
# interpreter and pip, not the development headers. Without this, compilation fails with
# "fatal error: Python.h: No such file or directory" the moment Triton tries to build its
# own native helper — confirmed via a real deploy, after the C-compiler and devel-image
# fixes above were already in place (this is a separate, later blocker in the same chain).
# curl + ca-certificates: needed for the weights download step below (HTTPS to
# huggingface.co) — not required by anything else in this image.
RUN apt-get update && apt-get install -y --no-install-recommends \
	python3.12 python3.12-dev python3-pip ffmpeg fonts-dejavu-core git build-essential libomp-dev \
	curl ca-certificates \
	&& rm -rf /var/lib/apt/lists/* \
	&& groupadd -g 65532 app \
	&& useradd -u 65532 -g app -M app

WORKDIR /app

ENV MODEL_WEIGHTS_PATH=/app/weights \
	PYTHONUNBUFFERED=1

# Real artifact filenames confirmed against the Lightricks/LTX-2.3 and
# Lightricks/gemma-3-12b-it-qat-q4_0-unquantized Hugging Face repos' own file listings
# (neither repo is gated — no HF token needed). Only the two LTX-2.3 files our code
# actually references (DISTILLED_CHECKPOINT_PATH, SPATIAL_UPSAMPLER_PATH in
# inference/model.py) are pulled — not the non-distilled/dev/LoRA/other-resolution
# variants also in that repo. Every non-metadata file in the Gemma repo is pulled since
# it's loaded as a real HF model directory (config.json, tokenizer files, processor
# config, sharded safetensors + index) via AutoTokenizer/AutoImageProcessor/
# Gemma3ForConditionalGeneration.from_pretrained, not a single standalone file.
# -f: fail (non-zero exit) on HTTP errors instead of writing an error page as if it were
# the file. -C -: resume a partially-downloaded file on retry instead of restarting from
# byte zero — real value given these are multi-GB files over a real network.
RUN set -eux; \
	mkdir -p /app/weights/gemma-3-12b-it-qat-q4_0-unquantized; \
	dl() { curl -fL --retry 5 --retry-delay 5 -C - -o "$1" "$2"; }; \
	dl /app/weights/ltx-2.3-22b-distilled-1.1.safetensors \
		https://huggingface.co/Lightricks/LTX-2.3/resolve/main/ltx-2.3-22b-distilled-1.1.safetensors; \
	dl /app/weights/ltx-2.3-spatial-upscaler-x2-1.1.safetensors \
		https://huggingface.co/Lightricks/LTX-2.3/resolve/main/ltx-2.3-spatial-upscaler-x2-1.1.safetensors; \
	for f in added_tokens.json chat_template.json config.json generation_config.json \
		model-00001-of-00005.safetensors model-00002-of-00005.safetensors \
		model-00003-of-00005.safetensors model-00004-of-00005.safetensors \
		model-00005-of-00005.safetensors model.safetensors.index.json \
		preprocessor_config.json processor_config.json special_tokens_map.json \
		tokenizer.json tokenizer.model tokenizer_config.json; do \
		dl "/app/weights/gemma-3-12b-it-qat-q4_0-unquantized/$f" \
			"https://huggingface.co/Lightricks/gemma-3-12b-it-qat-q4_0-unquantized/resolve/main/$f"; \
	done; \
	chown -R app:app /app/weights

COPY requirements.txt ./requirements.txt
# --default-timeout + --retries: torch's wheel is large and a plain pip install can hit
# a read timeout downloading it (confirmed via a local smoke-test build).
# --break-system-packages: ubuntu24.04's pip enforces PEP 668 (externally-managed-
# environment) by default, blocking plain `pip install` outside a venv. Safe to override
# here — this is an isolated single-purpose container, not a shared system Python.
#
# torch + torchaudio + torchvision installed first, together, from PyTorch's own cu128
# index (bundles a fixed, matching set of nvidia-cuda-*-cu12 runtime libs for this image's
# CUDA 12.8 base). Versions match the exact tested lockfile for the pinned commit
# (github.com/Lightricks/LTX-2/blob/a2c3f24078eb918171967f74b6f66b756b29ee45/uv.lock,
# resolution group `python_full_version == '3.12.*' and sys_platform == 'linux'`: torch
# 2.9.1, torchaudio 2.9.1, torchvision 0.24.1 for the standard — non-xformers,
# non-fp8-trtllm — extra, which is what we use) rather than an older pin we'd chosen
# ourselves: ltx-core's own declared constraint (`torch~=2.7`, bare unpinned
# `torchaudio`) is a loose compatibility bound, not what's actually tested — the
# lockfile is. All three must be pinned together here: none of them are routed to a
# CUDA-specific index in ltx-core's own [tool.uv.sources] (only xformers/tensorrt-llm
# are), so `pip install -r requirements.txt` below would otherwise resolve them from
# plain PyPI independently of each other — confirmed via real deploys this drifted to a
# CUDA-13-tagged torchaudio next to a CUDA 12.8 torch (broke `libcudart.so` loading), and
# separately left torchvision missing entirely (transformers' AutoImageProcessor
# requires it, nothing in requirements.txt pulled it in).
RUN pip3 install --no-cache-dir --default-timeout=300 --retries=5 --break-system-packages \
	torch==2.9.1 torchaudio==2.9.1 torchvision==0.24.1 --index-url https://download.pytorch.org/whl/cu128 \
	&& pip3 install --no-cache-dir --default-timeout=300 --retries=5 --break-system-packages -r requirements.txt

COPY --chown=app:app src ./src

# $HOME needs to be a real, writable directory regardless of caching — the app user is
# created with `useradd -M` (no home directory, deliberately — it's a single-purpose
# service account) so $HOME resolves to a nonexistent /home/app otherwise, and some
# writes under it fail with a permission error partway through generation (confirmed
# via a real deploy). Set here (not earlier, alongside MODEL_WEIGHTS_PATH) so it only
# affects the runtime container process, not the earlier root-run pip/git build steps
# above, which would otherwise see a $HOME that doesn't exist yet at that point in the
# build.
RUN mkdir -p /app/cache && chown app:app /app/cache
ENV HOME=/app/cache

# A persisted, GCS-mounted Triton/Torchinductor cache was tried and removed: it did work
# correctly (compiled kernels genuinely persisted and got reused across separate Job
# executions, confirmed via a real deploy), but the ~30min stall this was meant to fix
# turned out to be the separate weights-loading issue above, not kernel compilation —
# once that was fixed, the cache bucket wasn't providing enough value to justify its
# upkeep. Triton/Inductor now just use their own default cache location under $HOME
# (ephemeral, container-lifetime only) — still gives within-a-single-job reuse (warmup
# compiles once, real segments reuse it), just not persisted across separate executions.

USER app:app

# No HTTP surface at all — this runs as a Cloud Run Job, not a Service: one execution
# processes one video_jobs row (KLIPSE_JOB_ID env override) then exits. Cloud Run tracks
# the process exit code directly, no health-check probe needed.
CMD ["python3", "-m", "src.job_main"]
