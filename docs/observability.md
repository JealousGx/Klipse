# Observability

Klipse uses structured JSON-line logging with level-based filtering, shipped to Axiom via CF Observability Logs (main app) or direct HTTP drain (processor).

---

## Logger

`src/lib/logger.ts` — shared structured logger for the main app.

```ts
import { logger } from "@/lib/logger";

logger.info("job_dispatched", { jobId, userId });
logger.warn("provider_key_cooldown_set", { keyId, provider, cooldownUntil });
logger.error("webhook_failed", { jobId, status: 500, body });
logger.debug("dev_otp", { email, otp, type });
```

Every log line is one JSON object:

```json
{
  "level": "info",
  "message": "job_dispatched",
  "service": "klipse-main",
  "env": "production",
  "t": 1713456789000,
  "_time": "2025-04-18T12:13:09.000Z",
  "jobId": "job_01234...",
  "userId": "usr_01234..."
}
```

---

## Log Levels

| Level | Emitted when |
|---|---|
| `error` | Always |
| `warn` | Always |
| `info` | `KLIPSE_PERF_LOG=1` OR non-production environment |
| `debug` | `NODE_ENV=development` only |

In production, `error` and `warn` always appear. `info` requires `KLIPSE_PERF_LOG=1` in env. `debug` never appears in production.

---

## Log Context Fields

`LogContext` — typed fields on every call:

| Field | Type | Purpose |
|---|---|---|
| `userId` | `string` | Authenticated user ID |
| `jobId` | `string` | Video generation job ID |
| `requestId` | `string` | Trace / correlation ID |
| `status` | `number` | HTTP status code |
| `durationMs` | `number` | Duration in milliseconds |
| `[key: string]` | `unknown` | Any additional fields |

> `status` is typed as `number` (HTTP code). For string job statuses, use `jobStatus` as the key.

---

## Main App: CF Observability Logs → Axiom

In production, the main app runs as a CF Worker. Logger calls `console.log/warn/error` → CF captures all console output → ships to configured log destinations.

### wrangler.jsonc Config

```jsonc
"observability": {
  "logs": {
    "enabled": true,
    "destinations": ["main-app-logs"]
  },
  "traces": {
    "enabled": true,
    "destinations": ["main-app-traces"]
  }
},
"vars": {
  "KLIPSE_PERF_LOG": "1"
}
```

### CF Dashboard Destinations

In **Cloudflare dashboard → Workers & Pages → your worker → Settings → Observability → Destinations**:

**Logs destination (`main-app-logs`):**
- Endpoint: `https://api.axiom.co/v1/logs`
- Headers:
  - `Authorization: Bearer <axiom-api-token>`
  - `X-Axiom-Dataset: klipse`

**Traces destination (`main-app-traces`):** optional
- Endpoint: `https://api.axiom.co/v1/traces`
- Same auth headers

> Destination names must match `wrangler.jsonc` exactly (case-sensitive).

### Why Not Direct Axiom Fetch

CF Workers kill pending fetches after the response is sent. A bare `fetch()` in a microtask (`Promise.resolve().then(...)`) will be terminated mid-flight. CF Observability Logs handles this correctly — it's the only reliable path for CF Workers. The direct Axiom drain in `logger.ts` is only used by the external video processor (Node.js / Cloud Run), not CF.

---

## External Processor: Direct Axiom Drain

`packages/external-video-processor/src/logger.py` — Python reimplementation of the old `logger.ts`, same shape: structured JSON logs printed to stdout (captured by Cloud Run's own logging regardless) **and** a fire-and-forget HTTP POST to Axiom's ingest API (`POST https://api.axiom.co/v1/ingest/<dataset>`, confirmed against Axiom's real REST API docs) when `AXIOM_API_TOKEN` is set. Every module that logs imports this shared `logger` instance — no bare `print`/stdlib `logging` calls anywhere in the processor.

Same level gating as the main app's `src/lib/logger.ts`: `error`/`warn` always emitted, `info` only when `KLIPSE_PERF_LOG=1` or `ENVIRONMENT` is non-production, `debug` only in `local`/`development`.

Set env vars in Cloud Run:

```
AXIOM_API_TOKEN=<token>
AXIOM_DATASET=klipse
ENVIRONMENT=production
```

Logs from both main app and processor land in the same Axiom dataset, distinguished by `service` field:
- Main app: `"service": "klipse-main"`
- Processor: `"service": "klipse-processor"`

**Key log events:**

| Message | Level | Fields |
| --- | --- | --- |
| `job_start` | info | jobId, channelId, userId |
| `job_complete` | info | jobId, durationMs |
| `job_error` | error | jobId, durationMs, error |
| `job_error_callback_failed` | error | jobId, error |
| `script_generation_complete` | info | jobId, provider, model |
| `script_generation_exhausted` | error | jobId, error |
| `model_load_start` / `model_load_complete` | info | weightsRoot / durationMs — the real cold-start timing, since Phase 0's GPU validation was skipped, this is the actual source of that data now |
| `video_generation_start` / `video_generation_complete` | info | targetDuration, aspectRatio, numFrames, seed / durationMs |
| `watermark_failed` | error | error, returncode |
| `r2_upload_complete` | info | sizeBytes |
| `unauthorized_request` | warn | (auth failures on `/v1/process-spec`) |
| `retry_attempt_failed` / `retry_exhausted` | warn | label, attempt(s), delayMs, error |

---

## Error Tracking: Sentry

`src/lib/sentry.ts` + `instrument.server.mjs` — Sentry for exception tracking.

```ts
import { captureException } from "@/lib/sentry";

captureException(new Error("processor_failed"), { jobId, userId });
```

Set `SENTRY_DSN` (server) and `VITE_APP_SENTRY_DSN` (client) env vars.

Source maps uploaded during build via `SENTRY_AUTH_TOKEN`.

---

## Key Log Events Reference

### Job Lifecycle

| Message | Level | Fields |
|---|---|---|
| `content_pipeline_job_created` | info | userId, channelId, jobId, credits, creditsRemaining |
| `content_pipeline_insufficient_credits` | warn | userId, credits, creditsRemaining |
| `content_pipeline_idempotency_replay` | info | userId, idempotencyKey, ref |
| `content_pipeline_idempotency_claim_exhausted` | error | userId, idempotencyKey |
| `job_dispatch_cas_skip` | info | jobId, reason |
| `job_dispatched_to_processor` | info | jobId |
| `spec_build_start` | info | jobId, userId |
| `spec_build_complete` | info | jobId, userId, targetDuration, plan, isSoundEligible, modelChain, ttsVoice |
| `webhook_received` | info | jobId, userId, jobStatus |
| `webhook_already_terminal` | warn | jobId, userId, jobStatus |
| `video_job_complete` | info | jobId, userId |
| `video_job_failed` | error | jobId, userId, errorMessage |
| `job_marked_failed` | warn | jobId, message |

### Provider Keys

| Message | Level | Fields |
|---|---|---|
| `provider_key_cooldown_set` | warn | keyId, provider, errorType, cooldownUntil |
| `provider_key_cooldown_cleared` | info | keyId, provider |

### YouTube

| Message | Level | Fields |
|---|---|---|
| `youtube_token_exchange_ok` | info | userId, channelId, hasRefreshToken |
| `youtube_token_exchange_failed` | error | userId, channelId |
| `youtube_access_token_refreshed` | info | userId, channelId |
| `youtube_refresh_token_invalid_grant` | warn | userId, channelId |
| `youtube_channel_fetched` | info | userId, channelId, externalChannelId, title |
| `youtube_upload_complete` | info | jobId, userId, videoId, sizeBytes, durationMs, title |
| `youtube_oauth_connect_success` | info | userId, channelId, externalChannelId |
| `youtube_oauth_connect_denied` | warn | userId, channelId |

### Auth / Registration

| Message | Level | Fields |
|---|---|---|
| `polar_customer_create_failed` | error | userId, error |
| `dev_otp` | debug | email, otp, type |

---

## Debugging in Production

### Find all errors for a job

Axiom query:

```
level = "error" | jobId = "<job-id>"
```

### Find provider key failures for a provider

```
message = "provider_key_cooldown_set" | provider = "openrouter"
```

### Find jobs that never completed

```
message = "job_dispatched_to_processor"
| join message = "video_job_complete" on jobId
| where video_job_complete is null
```

### Check if info logs are flowing

Look for `spec_build_start` events. If missing, `KLIPSE_PERF_LOG=1` is not set — add to `wrangler.jsonc` vars and redeploy.
