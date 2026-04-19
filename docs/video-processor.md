# External Video Processor

The video processor is a standalone Hono/Node.js service that handles the computationally expensive stages of video generation: script → assets → FFmpeg encode → R2 upload → webhook callback. It runs as a Docker container locally and GCP Cloud Run in production.

Source: `packages/external-video-processor/`

---

## Endpoints

### `GET /health`

Health check. Returns `"ok"`. Used by Cloud Run health checks.

### `POST /v1/process-spec`

Full content pipeline. Accepts a `ProcessorJobSpec`, runs all 4 stages, calls complete callback.

**Auth:** `Authorization: Bearer <VIDEO_PROCESSOR_CLIENT_SECRET>`

**Body:** `ProcessorJobSpec` (see below)

**Response:**

```json
{ "accepted": true }              // 202 - queued
{ "accepted": true, "idempotent": true }  // 202 - already known (dedup)
{ "error": "invalid_body" }       // 400
{ "error": "unauthorized" }       // 401
{ "error": "server_misconfigured" } // 503 - missing env vars
```

### `POST /v1/process`

Assembly-only pipeline. Accepts a `VideoProcessorHandoffPayload` (pre-generated assets already in R2), runs FFmpeg + upload + callback only.

---

## Pipeline Stages

```
POST /v1/process-spec
    │
    ├── Validate spec (isProcessorJobSpec guard)
    ├── Dedup check (in-memory job set)
    └── enqueueSpecJob(spec)
         │
         ▼
    executor.ts — executeJob(spec)
         │
         ├── Stage 1: Script
         │    ├── generateScript(spec) — OpenRouter/Gemini API
         │    ├── Parse JSON response { voiceover, imagePrompts[], title, description, tags }
         │    ├── Fallback: regex/tag extraction if model ignores response_format
         │    └── Truncate voiceover to target word count (~140 words/min)
         │
         ├── Stage 2: Prepare
         │    ├── TTS: synthesizeSpeech(spec, ttsText) — concurrent with images
         │    ├── Images: generateImage(spec, prompt) × 3 — sequential (Replicate burst=1)
         │    └── Sound: generateSound(spec) — optional, Creator+ only
         │         (all assets written to local /tmp/)
         │
         ├── Stage 3: Assemble
         │    ├── FFmpeg: images + TTS audio → base video
         │    ├── Mix sound (if generated)
         │    ├── Apply watermark (free tier)
         │    └── Upload output.mp4 → R2 via presigned PUT URL
         │
         └── reportComplete(spec, "completed", scriptText, title, description, tags)
              └── POST <callbackBaseUrl>/api/internal/video-processor/assembly-complete
```

On any stage error:

```
reportComplete(spec, "failed", errorMessage)
    └── POST <callbackBaseUrl>/api/internal/video-processor/assembly-complete
```

Error message prefixed with stage name: `[script] <original error>`, `[prepare] <error>`, etc.

---

## ProcessorJobSpec

Full spec sent by main app to `/v1/process-spec`:

```ts
{
  // Identity
  jobId: string;
  userId: string;
  channelId: string;

  // Script prompts (pre-built by main app)
  scriptSystemPrompt: string;
  scriptUserPrompt: string;

  // AI config
  openrouterScriptModels: string[];   // model chain, tried in order
  ttsVoice: string;                   // e.g. "en-US-Wavenet-G"

  // Video config
  targetDuration: number;             // seconds
  aspectRatio: "9:16" | "16:9" | "1:1";
  freeTierWatermark: boolean;
  watermarkLabel: string;

  // Sound (optional, null = disabled)
  soundPrompt: string | null;
  soundDurationSeconds: number;

  // Provider keys (all 6 providers, active keys only)
  providerKeys: {
    openrouter: ProviderApiKeyCredential[];
    gemini: ProviderApiKeyCredential[];
    googleTts: ProviderApiKeyCredential[];
    replicate: ProviderApiKeyCredential[];
    unrealSpeech: ProviderApiKeyCredential[];
    elevenlabs: ProviderApiKeyCredential[];
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

---

## Callback Endpoints (Processor → App)

All callbacks use `Authorization: Bearer <callbackSecret>` and retry on failure.

### Progress

`POST <callbackBaseUrl>/api/internal/processor/progress`

Fired at each stage transition. Retries: 3.

```json
{ "jobId": "...", "stage": "script", "progress": 10 }
```

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

### Complete

`POST <callbackBaseUrl>/api/internal/video-processor/assembly-complete`

Fired on success or failure. Retries: 8.

```json
{
  "jobId": "...",
  "userId": "...",
  "status": "completed",
  "scriptText": "full script markdown...",
  "title": "AI-generated title",
  "description": "Short caption for YouTube/TikTok",
  "tags": ["tag1", "tag2"]
}
```

Or on failure:

```json
{
  "jobId": "...",
  "userId": "...",
  "status": "failed",
  "error": "[assemble] ffmpeg exited with code 1"
}
```

---

## Script Response Format

The processor expects the LLM to return structured JSON:

```json
{
  "voiceover": "Full spoken narration text...",
  "imagePrompts": [
    "Cinematic shot of X, dramatic lighting",
    "Close-up of Y, vibrant colors",
    "Wide aerial view of Z"
  ],
  "title": "Video title",
  "description": "Short caption for publishing",
  "tags": ["tag1", "tag2", "tag3"]
}
```

**Fallback parsing:** If the model returns markdown instead of JSON:

1. Extracts voiceover from `[VOICEOVER]...[/VOICEOVER]` tags, or strips markdown manually
2. Extracts image prompts from `[VISUAL_SCENES]...[/VISUAL_SCENES]` tags, or parses "Visual scenes" section
3. `title`/`description`/`tags` unavailable in fallback path

---

## In-Process Idempotency

Active job set held in memory (`isSpecJobKnown`, `isAssemblyJobKnown`). If same `jobId` arrives again before processing completes (e.g. main app retry), returns `202 { idempotent: true }` immediately.

Memory-only — does not survive process restarts. Cloud Run restart during processing: main app's stuck-dispatch recovery re-dispatches after 3-minute timeout.

---

## Environment Variables

| Variable                         | Required | Description                                    |
| -------------------------------- | -------- | ---------------------------------------------- |
| `VIDEO_PROCESSOR_CLIENT_SECRET`  | ✅       | Bearer secret — app → processor authentication |
| `VIDEO_PROCESSOR_WEBHOOK_SECRET` | ✅       | Bearer secret — processor → app callbacks      |
| `PORT`                           |          | HTTP port (default: `8790`)                    |
| `SENTRY_DSN`                     |          | Sentry exception reporting                     |
| `ENVIRONMENT`                    |          | Deployment label (`local` / `production`)      |
| `KLIPSE_PERF_LOG`                |          | Set to `1` for info-level logs                 |
| `AXIOM_API_TOKEN`                |          | Direct Axiom log drain (fire-and-forget fetch) |
| `AXIOM_DATASET`                  |          | Axiom dataset (default: `klipse`)              |

Provider API keys are passed in the job spec — not read from env.

---

## Local Development

```bash
# Start processor container (builds first)
pnpm processor:docker:setup

# Stream logs
pnpm processor:docker:logs

# Stop
pnpm processor:docker:down

# Type-check
pnpm processor:typecheck
```

Processor runs on `:8790`. Set `VIDEO_PROCESSOR_URL=http://localhost:8790` in main app `.env.local`.

For Docker-to-host networking: set `APP_PUBLIC_URL=http://host.docker.internal:3000` so callbacks reach the main app.

---

## Processor Logger

`packages/external-video-processor/src/utils/logger.ts`

Same structured JSON format as main app. `service: "klipse-processor"` in every log line. Ships to Axiom via direct HTTP drain (safe on Node.js/Cloud Run — no `waitUntil` issue).

Key log events:

| Message                        | Level | Fields                   |
| ------------------------------ | ----- | ------------------------ |
| `processor_listening`          | info  | port                     |
| `job_start`                    | info  | jobId, channelId         |
| `stage_complete`               | info  | jobId, stage, durationMs |
| `job_complete`                 | info  | jobId, durationMs        |
| `job_error`                    | error | jobId, durationMs, error |
| `script_stage_start/complete`  | info  | jobId, durationMs        |
| `prepare_stage_start`          | info  | jobId                    |
| `job_complete_callback_failed` | error | jobId, error             |
