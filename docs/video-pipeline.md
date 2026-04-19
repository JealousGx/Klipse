# Video Pipeline

End-to-end flow from user idea submission to published video.

---

## Pipeline Kinds

| Kind | Description |
|---|---|
| `content_pipeline_v1` | Full pipeline: script → assets → FFmpeg encode → publish |
| `stub_pipeline_v1` | Stub jobs (no encode) — used for testing/demo |
| `publish_only_v1` | Re-publish an existing `output_url` to a new channel |

---

## Job Lifecycle

### Statuses

```
queued → dispatched → processing → completed
                   ↘              ↘ failed
```

| Status | Meaning |
|---|---|
| `queued` | Created, waiting to be picked up by worker |
| `dispatched` | CAS claimed — spec sent (or being sent) to processor |
| `processing` | Processor acknowledged, encoding in progress |
| `completed` | Output uploaded to R2, `output_url` set |
| `failed` | Terminal failure, `error_message` set |

**Failed jobs** can be manually retried from the dashboard up to 3 times (`retry_count` column).

---

## Content Pipeline Flow

```
1. User submits idea
   └── content-pipeline-execute.server.ts
        ├── Idempotency check (usage_idempotency table)
        ├── Credit balance check
        ├── Create video_job row (status=queued)
        ├── Deduct credits + record credit_transaction
        ├── Report usage to Polar meter
        └── Return jobId — dispatch is async via cron

2. Cron fires every ~1 min
   └── POST /api/cron/dispatch-queued-jobs
        └── dispatchQueuedJobs()
             ├── SELECT queued jobs (+ stuck dispatched, 3min cutoff)
             ├── Limit: 10 per tick
             └── process-content-pipeline.server.ts (per job)
             ├── Read job: check status/pipelineKind
             ├── Skip if terminal (completed/failed)
             ├── Skip if non-queued and not stuck-dispatch
             └── dispatchContentJob(jobId)
                  ├── CAS: UPDATE status=dispatched WHERE status=queued
                  │    └── If 0 rows affected → already claimed, skip
                  ├── buildProcessorJobSpec(jobId)
                  │    ├── Fetch job + user + channel from DB (single JOIN query)
                  │    ├── Build script prompts from channel brief
                  │    ├── Fetch all provider key credentials (bundled, 2 queries)
                  │    └── Generate presigned R2 PUT URL for output video
                  └── POST spec to VIDEO_PROCESSOR_URL/process

3. External Video Processor (:8790)
   ├── Stage 1: Script
   │    └── Gemini 2.5 Flash → OpenRouter fallback chain
   ├── Stage 2: Prepare
   │    ├── Generate images (Replicate SDXL — local /tmp/)
   │    ├── Generate TTS narration (Google Cloud TTS → Unreal Speech fallback)
   │    └── Generate sound effect if eligible (ElevenLabs, Creator+ only)
   ├── Stage 3: Assemble
   │    └── FFmpeg: images + TTS audio + sound → output.mp4
   └── Stage 4: Upload
        ├── PUT output.mp4 → R2 presigned URL
        └── POST /api/internal/video-processor/assembly-complete

4. Webhook handler
   └── video-assembly-processor-webhook.server.ts
        ├── Verify bearer token (VIDEO_PROCESSOR_WEBHOOK_SECRET)
        ├── CAS: UPDATE status=completed WHERE status IN (dispatched, processing)
        │    └── If 0 rows → check for idempotent replay
        ├── Set outputUrl, artifacts (scriptText, title, description, tags)
        ├── Mark free tier video consumed if needed
        └── runAfterVideoRenderComplete
             ├── Trigger YouTube publish (if auto-post enabled)
             └── Send completion notification
```

---

## Processor Job Spec

`ProcessorJobSpec` (defined in `@klipse/video-assembly-shared`):

```ts
{
  jobId: string;
  userId: string;
  channelId: string;

  // Script generation
  scriptSystemPrompt: string;
  scriptUserPrompt: string;
  openrouterScriptModels: string[];   // model chain for fallback

  // TTS
  ttsVoice: string;                   // e.g. "en-US-Wavenet-G"
  targetDuration: number;             // seconds, clamped by plan

  // Video config
  aspectRatio: "9:16" | "16:9" | "1:1";
  freeTierWatermark: boolean;
  watermarkLabel: string;

  // Sound (optional, Creator+)
  soundPrompt: string | null;
  soundDurationSeconds: number;

  // Provider keys (all 6 providers, bundled)
  providerKeys: Record<AiProviderKind, ProviderApiKeyCredential[]>;

  // Storage
  presignedUrls: { outputVideo: string };

  // Callback
  callbackBaseUrl: string;
  callbackSecret: string;
}
```

---

## Processor Callback Payload

`POST <callbackBaseUrl>/api/internal/video-processor/assembly-complete`

```json
{
  "jobId": "...",
  "userId": "...",
  "status": "completed",
  "scriptText": "...",
  "title": "AI-generated title",
  "description": "AI-generated description",
  "tags": ["tag1", "tag2"]
}
```

Or on failure:

```json
{
  "jobId": "...",
  "userId": "...",
  "status": "failed",
  "error": "ffmpeg_encode_failed: exit code 1"
}
```

Callback is idempotent — duplicate calls with same terminal state return `{ replayed: true }`.

---

## Stuck-Dispatch Recovery

A job can get stuck in `status=dispatched, currentStage=dispatch_pending` if the app crashed between the CAS update and the POST to the processor.

`process-content-pipeline.server.ts` detects this and re-dispatches:

```ts
const isStuckDispatch =
  row.status === "dispatched" &&
  row.currentStage === PIPELINE_STAGE.DISPATCH_PENDING;

if (row.status !== "queued" && !isStuckDispatch) {
  // skip — already in flight or terminal
  return;
}
```

When queue message is retried (CF Queues has retry semantics), the stuck-dispatch case re-sends the spec to the processor.

---

## Provider Key Failure Reporting

Processor reports key failures mid-job via internal API:

`POST /api/internal/processor/key-failure`

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

App classifies + persists cooldown. Future jobs pick active (non-cooled) keys via the standard query.

---

## Pipeline Stages (currentStage values)

Defined in `PIPELINE_STAGE`:

| Stage | Meaning |
|---|---|
| `dispatch_pending` | CAS done, POST to processor in-flight |
| `script` | Processor generating script |
| `prepare` | Processor fetching/generating assets |
| `assemble` | FFmpeg encoding |
| `upload` | Uploading to R2 |
| `done` | Complete |

---

## Idempotency

`usage_idempotency` table prevents duplicate job creation on queue re-delivery or double-submit:

- Key: `(userId, channelId, idempotencyKey)`
- `idempotencyKey` is user-supplied or generated from idea + timestamp
- On conflict: returns existing `jobId` (`content_pipeline_idempotency_replay` log)
- After N failed claim attempts: `content_pipeline_idempotency_claim_exhausted` error

---

## Credit Deduction Timing

Credits deducted **before** job starts. Calculated from:
- Script generation: fixed 5 credits
- Images: `imageCount × 2` credits
- TTS: `ceil(charEstimate / 1000) × 4` credits
- Assembly: 3 credits

Estimate is based on target duration and average script density. If actual TTS is longer than estimated, no additional deduction — estimation is conservative.
