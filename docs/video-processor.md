# External Video Processor

The video processor is a standalone Python (FastAPI) service that runs a self-hosted LTX-2.3 model to generate a full multi-scene video with synchronized audio from a single prompt, then watermarks (free tier) and uploads the result to R2. It runs as a Docker container locally (CPU-only, for API/plumbing testing — real generation needs a GPU) and a GCP Cloud Run **GPU** service in production.

Source: `packages/external-video-processor/`

This is a full rewrite of the previous Node/Hono/FFmpeg pipeline (image generation + TTS + ffmpeg Ken-Burns assembly) — that pipeline produced low-retention, slideshow-style videos. The self-hosted model generates real animated multi-scene video directly, eliminating the separate image-gen/TTS/assembly stages entirely. There is no fallback to the old pipeline; this is the only pipeline going forward.

---

## Endpoints

### `GET /health`

Liveness/startup check. Returns `{ "ok": true }`. Deliberately does **not** touch the model/VRAM, so Cloud Run health checks don't force a cold-start load before real traffic arrives.

### `POST /v1/process-spec`

Runs the whole job synchronously in a background worker: script generation → single-call video+audio generation → watermark (free tier) → R2 upload → completion callback.

**Auth:** `Authorization: Bearer <VIDEO_PROCESSOR_CLIENT_SECRET>`

**Body:** `ProcessorJobSpec` (see below)

**Response:**

```json
{ "accepted": true }                      // 202 - queued
{ "accepted": true, "idempotent": true }  // 202 - already known (dedup)
```

Auth/validation failures return standard FastAPI 401/422 responses.

The old assembly-only `/v1/process` endpoint (pre-generated assets already in R2) does not exist in this rewrite — it was tied to the retired image/TTS pipeline.

---

## Pipeline Stages

```
POST /v1/process-spec
    │
    ├── Validate spec (Pydantic model)
    ├── Dedup check (in-memory job set)
    └── enqueue onto the serial worker queue (Cloud Run concurrency = 1)
         │
         ▼
    main.py — _run_job(spec)
         │
         ├── Stage 1: Script
         │    ├── generate_script(...) — OpenRouter (model chain) → Gemini fallback
         │    ├── Parse JSON response { video_prompt, title, description, tags }
         │    └── video_prompt is ONE comprehensive prompt (LTX-2.3 prompt-guide
         │        structured) describing the full multi-scene video — narration/
         │        dialogue/audio are woven directly into the prompt text, there is
         │        no separate voiceover/TTS field
         │
         ├── Stage 2: Video generation (single call)
         │    └── generate_video(video_prompt, target_duration, aspect_ratio)
         │         — one call to the self-hosted LTX-2.3 distilled pipeline,
         │           returns (video, audio) which their own encode_video()
         │           utility muxes into one MP4 — no chaining, no per-scene
         │           reference-frame conditioning, no separate TTS/image/sound
         │           calls, no ffmpeg concat step
         │
         ├── Stage 3: Watermark (free tier only)
         │    └── apply_watermark_with_audio(...) — ffmpeg drawtext, deterministic
         │        pixel-exact overlay (not prompt-baked — diffusion models render
         │        burned-in text unreliably)
         │
         ├── Stage 4: Upload
         │    └── upload_bytes_to_presigned_url(...) → R2 via presigned PUT
         │
         └── report_complete(spec, "completed", script_text=video_prompt, title, description, tags)
              └── POST <callbackBaseUrl>/api/internal/video-processor/assembly-complete
```

On any stage error:

```
report_complete(spec, "failed", error=str(e))
    └── POST <callbackBaseUrl>/api/internal/video-processor/assembly-complete
```

---

## ProcessorJobSpec

Full spec sent by main app to `/v1/process-spec` (see `packages/video-assembly-shared/src/processor-spec.ts`):

```ts
{
  // Identity
  jobId: string;
  userId: string;
  channelId: string;

  // Script prompts (pre-built by main app, instructs the LLM to output ONE
  // comprehensive video_prompt per the LTX-2.3 prompt guide's technique)
  scriptSystemPrompt: string;
  scriptUserPrompt: string;

  // AI config
  openrouterScriptModels: string[];   // model chain, tried in order

  // Video config
  targetDuration: number;             // seconds
  aspectRatio: "9:16" | "16:9" | "1:1";
  freeTierWatermark: boolean;
  watermarkLabel: string;

  // Provider keys — script-gen only (no image/TTS/sound providers anymore)
  providerKeys: {
    openrouter: ProviderApiKeyCredential[];
    gemini: ProviderApiKeyCredential[];
  };

  // Storage
  presignedUrls: {
    outputVideo: string;    // R2 presigned PUT URL for final output.mp4
  };

  // Callback
  callbackBaseUrl: string; // e.g. "https://klipse.app"
  callbackSecret: string;  // VIDEO_PROCESSOR_WEBHOOK_SECRET value
}
```

Removed fields versus the old pipeline: `ttsVoice`, `soundPrompt`, `soundDurationSeconds`, and the `googleTts`/`replicate`/`unrealSpeech`/`elevenlabs` provider key arrays.

---

## Callback Endpoints (Processor → App)

All callbacks use `Authorization: Bearer <callbackSecret>` and retry on failure. Endpoints and payload shapes are unchanged from the old pipeline — the main app's webhook handlers needed no changes.

### Progress

`POST <callbackBaseUrl>/api/internal/processor/progress`

Fired at each stage transition. Retries: 3.

```json
{ "jobId": "...", "stage": "script", "progress": 10 }
```

`stage` is `"script" | "video_gen"` (the old `"prepare"`/`"assemble"` stages no longer exist).

### Key Failure

`POST <callbackBaseUrl>/api/internal/processor/key-failure`

Fired when a provider API key returns a classifiable HTTP error. Retries: 5.

```json
{
  "jobId": "...",
  "provider": "openrouter",
  "keyId": "key_abc123",
  "httpStatus": 429,
  "bodySnippet": "rate limit exceeded",
  "retryAfterHeader": "60"
}
```

`provider` is `"openrouter" | "gemini"` only now (script-gen providers).

### Complete

`POST <callbackBaseUrl>/api/internal/video-processor/assembly-complete`

Fired on success or failure. Retries: 8.

```json
{
  "jobId": "...",
  "userId": "...",
  "status": "completed",
  "scriptText": "the full video_prompt text...",
  "title": "AI-generated title",
  "description": "Short caption for YouTube/TikTok",
  "tags": ["tag1", "tag2"],
  "durationSec": 30
}
```

Note: `scriptText` is now the joined `video_prompt` (a scene-description/narrative brief), not a verbatim spoken transcript like the old `voiceover` field — the model invents actual narration wording as part of generation.

Or on failure:

```json
{
  "jobId": "...",
  "userId": "...",
  "status": "failed",
  "error": "script_generation_exhausted:..."
}
```

---

## Script Response Format

The processor expects the LLM to return structured JSON:

```json
{
  "video_prompt": "One comprehensive prompt describing the full multi-scene video — subjects, actions, camera movement, lighting/mood, and narration/dialogue/audio cues woven directly into the prose, per the LTX-2.3 prompt guide's technique...",
  "title": "Video title",
  "description": "Short caption for publishing",
  "tags": ["tag1", "tag2", "tag3"]
}
```

No `voiceover`/`imagePrompts` fields — those belonged to the old three-image slideshow pipeline. `parse_script_json` in `script_gen.py` handles the same defensive extraction as the old pipeline (markdown-fence stripping, multi-candidate JSON extraction, truncated-JSON repair) for LLM output reliability.

---

## Model Weights (baked into the image — downloaded from Hugging Face at build time)

Two earlier approaches were tried and abandoned:
1. **Baked into a separate staging image** (`Dockerfile.weights` + a `WEIGHTS_IMAGE` build arg) — every app-code push still had to pull+extract the full 56GB+ weights layer, since Cloud Build's shared workers don't persist a local image cache between separate build runs.
2. **Mounted from a GCS bucket at runtime** (Cloud Run's native Cloud Storage volume mount) — avoided the build-time cost, but a real deploy confirmed the GCS FUSE mount was satisfying weight reads lazily/on-demand rather than eagerly loading everything upfront, causing a ~30min stall on every single job's first forward pass. Google's own docs confirm large sequential reads over Cloud Storage FUSE are network-bandwidth-limited, and recommend baking models into the image instead.

**Current approach:** weights are downloaded directly from Hugging Face inside `processor/Dockerfile` itself, as an early `RUN` step (before `COPY src`, right after installing system packages) — no separate staging image, no GCS bucket, no build arg. Because it's an ordinary early Dockerfile layer, Docker's layer cache (backed by our registry-based buildx cache in `cloudbuild.yaml`) means this step only re-executes when its own content changes (i.e. when we bump the model version) — ordinary code-only pushes never re-download anything.

Real artifacts confirmed against the `Lightricks/LTX-2.3` and `Lightricks/gemma-3-12b-it-qat-q4_0-unquantized` Hugging Face repos' own file listings (neither repo is gated — no HF token needed):

| Artifact | Source | Size |
| --- | --- | --- |
| Distilled checkpoint | `Lightricks/LTX-2.3` → `ltx-2.3-22b-distilled-1.1.safetensors` | 46.1 GB |
| Spatial upsampler (x2) | `Lightricks/LTX-2.3` → `ltx-2.3-spatial-upscaler-x2-1.1.safetensors` | 996 MB |
| Gemma 3-12B text encoder | `Lightricks/gemma-3-12b-it-qat-q4_0-unquantized` (all files — full HF model directory layout) | ~22.7 GB |

**Refreshing weights (rare — only on model version changes):** update the filenames/commit references in the `Dockerfile`'s weights `RUN` step, then push — the next build re-downloads only that changed layer.

**Building/deploying the app** is a single, ordinary `docker build` — no separate weights image, no GCS bucket setup, no build args:
```bash
docker build -f processor/Dockerfile -t klipse-external-video-processor:latest processor/
```
`cloudbuild.yaml` (repo root, auto-triggered on push) reflects this.

**System requirements (confirmed from the official repo):** Python >=3.12, CUDA >12.7, PyTorch ~=2.7, **32GB+ VRAM**, 100GB+ free disk space. The 32GB+ VRAM requirement rules out Cloud Run's L4 tier (24GB) — production uses the RTX Pro 6000 tier (96GB).

---

## In-Process Idempotency

Active/finished job sets held in memory (`_active_job_ids`, `_finished_job_ids` — a bounded set, same pattern as the old `BoundedSet`). If the same `jobId` arrives again before processing completes, returns `202 { idempotent: true }` immediately. A single in-process `asyncio.Queue` worker processes one job at a time, matching the Cloud Run concurrency=1 requirement.

Memory-only — does not survive process restarts. Cloud Run restart during processing: main app's stuck-dispatch recovery re-dispatches after the configured timeout.

---

## Environment Variables

| Variable                         | Required | Description                                    |
| -------------------------------- | -------- | ----------------------------------------------- |
| `VIDEO_PROCESSOR_CLIENT_SECRET`  | ✅       | Bearer secret — app → processor authentication |
| `PORT`                           |          | HTTP port (default: `8790`)                    |
| `MODEL_WEIGHTS_PATH`             |          | Local baked-in weights root (default: `/app/weights`) |
| `ENVIRONMENT`                    |          | Deployment label — controls log verbosity (`local`/`development`/`staging`/`production`) |
| `KLIPSE_PERF_LOG`                |          | Set to `1` to enable info-level logs in production |
| `AXIOM_API_TOKEN`                |          | Direct Axiom log drain (fire-and-forget, `src/logger.py`) |
| `AXIOM_DATASET`                  |          | Axiom dataset name (default: `klipse`)         |

The old `VIDEO_PROCESSOR_WEBHOOK_SECRET`-equivalent is passed per-job in the spec's `callbackSecret` field, not read from the processor's own env — same as before. Provider API keys are also passed in the job spec, not read from env.

---

## Local Development

```bash
# Start processor container (builds first)
pnpm processor:docker:setup

# Stream logs
pnpm processor:docker:logs

# Stop
pnpm processor:docker:down
```

Processor runs on `:8790`. Set `VIDEO_PROCESSOR_URL=http://localhost:8790` in main app `.env.local`.

For Docker-to-host networking: set `APP_PUBLIC_URL=http://host.docker.internal:3000` so callbacks reach the main app.

**Testing without a GPU:** the FastAPI app itself (auth, script-gen, callbacks, watermark, upload) can run directly via `uvicorn src.main:app --port 8790` on plain CPU — none of that code touches the model until the video-generation stage. A job will run real script-gen, then fail predictably at that stage with a clear error until real GPU weights and hardware are available.

---

## Processor Logger

`packages/external-video-processor/src/logger.py` — structured JSON logger with a direct Axiom drain, same shape as the main app's logger. See [docs/observability.md](observability.md#external-processor-direct-axiom-drain) for the full key-log-events reference and env var setup.
