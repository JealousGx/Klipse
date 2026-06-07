# Klipse — Full Session Handoff

**Repo:** `/Users/khilji/Development/projects/klipse`  
**Main branch:** `main`  
**Worktree (Claude):** `/Users/khilji/Development/projects/klipse/.claude/worktrees/quizzical-elbakyan` on branch `claude/quizzical-elbakyan`  
**Last updated:** 2026-05-12  
**Assistant style:** Caveman mode active (full). `/caveman` to toggle, "stop caveman" / "normal mode" to disable.

---

## What Klipse Is

AI-powered short-form video SaaS. User submits a text idea → main app (TanStack Start / Cloudflare Worker) queues a job → cron dispatches to external video processor (Hono/Node on GCP Cloud Run) → pipeline: Gemini/OpenRouter script → Replicate/OpenRouter SDXL images → Google TTS / Unreal Speech narration → optional ElevenLabs background sound → FFmpeg encode → R2 upload → POST callback → YouTube auto-publish.

Credits deducted at job creation (not completion). Polar handles subscriptions + metering.

---

## Architecture

```
Main app (CF Worker)  :3000 dev / klipse.app prod
  src/                TanStack Start SSR + server fns
  MySQL ← Drizzle ORM (TiDB Cloud serverless prod)
  Cloudflare R2       final output.mp4 ONLY
  Cron: POST /api/cron/dispatch-queued-jobs every ~1 min

  ──POST /v1/process-spec (ProcessorJobSpec)──▶

External Processor (GCP Cloud Run)  :8790 dev
  packages/external-video-processor/
  Hono server, no CF Workers constraints
  Stage 1: script (Gemini/OpenRouter LLM)
  Stage 2: prepare (SDXL images + TTS + sound → local /tmp/)
  Stage 3: assemble (FFmpeg encode → watermark → presigned PUT to R2)
  POST callback → main app /api/internal/video-processor/assembly-complete
```

**Hard invariants — never violate:**

- Intermediate assets (images, TTS audio, sound) stay in processor `/tmp/` ONLY — never uploaded to R2
- Only `output.mp4` goes to R2 via presigned PUT URL in `ProcessorJobSpec.presignedUrls.outputVideo`
- No CF Queue, no CF Worker for video — dispatch is pure cron polling
- `klipse-worker` package is obsolete/removed — no `workers/` directory exists

---

## Full File Map

```
src/
  routes/
    _authed/dashboard/
      jobs.tsx                        job list page — cursor pagination UI
      analytics.tsx                   analytics page
      generate.tsx                    video generation form
      publishing.tsx                  publishing destinations (YouTube OAuth)
      billing.tsx
      settings.tsx
    _authed/admin/
      jobs.tsx                        admin job list — cursor pagination
      users.tsx                       admin user list — cursor pagination + total count
    api/
      cron/
        dispatch-queued-jobs.ts       picks up queued/stuck jobs, calls dispatchQueuedJobs()
        trigger-scheduled-jobs.ts     fires channel schedules when nextRunAt <= now
        purge-expiring-assets.ts      deletes expired R2 objects + their DB rows
      internal/
        video-processor/
          assembly-complete.ts        processor → app terminal callback (Zod validated)
        processor/
          progress.ts                 processor → app stage progress update
          key-failure.ts              processor → app: update provider key cooldown
      youtube/oauth/
        callback.ts                   YouTube OAuth callback handler

  features/
    video/
      pipeline/
        content-pipeline-execute.server.ts   creates job row + deducts credits + queues
        dispatch-queued-jobs.server.ts        SELECT queued/stuck jobs (max 10/tick)
        process-video-job-dispatch.server.ts  routes job to pipeline handler by pipelineKind
        process-content-pipeline.server.ts    CAS queued→dispatched + sends to processor
        dispatch-content-job.server.ts        builds ProcessorJobSpec + POSTs to processor
        build-processor-job-spec.server.ts    fetches job/channel/user, builds full spec
        video-assembly-processor-webhook.server.ts  handles terminal callback, writes artifacts
        video-job-after-render.server.ts      registers expiry TTL + dispatches publish
        free-tier-video-consumed.server.ts    marks free_video_consumed on first job done
        pipeline-kind.ts                      PIPELINE_KIND / PIPELINE_STAGE enums + labels
        process-stub-pipeline.server.ts       markVideoJobFailed helper
      video-jobs.service.server.ts            listVideoJobsForUser (cursor pagination)
      video-jobs.functions.ts                 listVideoJobsFn / publishApprovalFn (server fns)
      video-job-constants.ts                  LIST_JOBS_DEFAULT_PAGE_SIZE=10, MAX_MANUAL_RETRIES=3
      video-job-list.types.ts                 VideoJobListRow type

    analytics/
      analytics.service.server.ts            getAnalyticsSummaryForUser

    billing/
      credit-costs.ts                        CREDIT_COSTS const + helper fns
      tier-config.ts                         MAX_CHANNELS_BY_PLAN, MONTHLY_CREDITS_BY_PLAN etc
      polar-plugin.server.ts                 Better Auth Polar plugin setup
      polar-sdk.server.ts                    Polar SDK singleton

    channels/
      channels.service.server.ts             CRUD for channels
      channel-config.schema.ts               Zod schema for channels.config JSON

    entitlements/
      plan-gates.ts                          planAllowsSound, clampTargetDuration etc

    publishing/
      request-platform-publish.server.ts     routes to YouTube/TikTok/Instagram
      publish-dispatch.server.ts             after-render publish dispatch
      youtube/
        run-youtube-publish-for-job.server.ts  full publish flow
        youtube-upload-api.server.ts         uploadMp4ToYoutube + fitTagsToYoutubeBudget
        build-youtube-video-metadata.server.ts  builds title/desc/tags from artifacts
        youtube-oauth-tokens.server.ts       get/refresh access token

    admin/
      admin-user.server.ts                   listAdminUsers (cursor + search + total COUNT)
      admin-jobs.server.ts                   listAdminJobs (cursor, no total)
      admin-user.functions.ts                server fns for admin user management
      admin-jobs.functions.ts                server fns for admin job management
      admin.guard.server.ts                  requireAdmin() — throws if not admin

    ai/
      config/
        model-routing.ts                     DEFAULT_MODEL_IDS, buildOpenRouterModelChain
        ai-routing-policy.server.ts          policy for which provider handles each task
      lib/
        provider-key-execution.server.ts     executeWithProviderKeyRotation (round-robin + cooldown)
        provider-api-keys.server.ts          listProviderApiKeyCredentials
        provider-key-failure-classify.server.ts  classify HTTP failures → cooldown duration
        provider-api-key-state.server.ts     recordProviderKeyFailure, clearCooldown
        api-key-pool.server.ts               RoundRobinPool
        provider-key-bundle.server.ts        bundleProviderKeysForProcessor
      prompts/
        channel-brief.server.ts             channelToCreativeBrief
        voiceover-prompt.server.ts           selectVoiceForChannelTone
        image-prompt.server.ts
        sound-prompt.server.ts
      script-generation.server.ts            buildScriptPrompts (shortForm + longForm system prompts)

    user/
      me.server.ts                           getMeForUser
      types/me.ts                            MeResponse type (plan, credits, etc.)

  db/
    index.ts                                 getDb() singleton
    schema/
      users.ts                               plan, creditsRemaining, freeVideoConsumed, role, banned
      channels.ts                            platform, config (JSON), soundEnabled, oauthRefreshToken
      video-jobs.ts                          status, currentStage, artifacts (JSON), publishApprovalStatus
      schedules.ts                           frequency, nextRunAt, jitterMinutes, enabled
      provider-api-keys.ts                   provider, secret, cooldownUntil, taskType, modelId
      credit-transactions.ts                 type (usage/purchase/refund), amount
      expiring-assets.ts                     kind (tts_intermediate/output), expiresAt, logicalKey
      usage-idempotency.ts                   scope, clientKey, status (processing/completed), result
      site-settings.ts                       registrationEnabled (single-row global settings)
      accounts.ts / sessions.ts / verifications.ts  Better Auth managed

  lib/
    auth/
      index.ts                               betterAuth instance (email OTP + Google + admin + Polar)
      admin-access-control.ts                ac, adminRoles
      admin-create-context.ts                isAdminCreate() async context bypass
    storage/
      r2.server.ts                           uploadToR2, deleteFile, getSignedUrlForUpload
      r2-presigned.server.ts                 generateJobPresignedUrls → { outputVideo }
    queries/
      dashboard-queries.ts                   videoJobsQueryOptions(cursor?, pageSize?)
    email/
      auth-otp.ts
      admin-invite.ts
    logger.ts                                structured JSON logger (logger.info/warn/error)
    sentry.ts                                captureException wrapper
    id.ts                                    UUIDv7 typed generators (userId, jobId, etc.)
    perf-timing.ts                           withPerfTiming

  components/
    shared/
      pagination.tsx                         CursorPagination component
    dashboard/
      pipeline-story.tsx                     JobQueueStoryCard
      job-status-pill.tsx
    ui/                                      Shadcn/Radix components

  env.ts                                     T3Env + Zod env schema (all env vars declared here)
  config/site.ts                             siteConfig (name, origin)

packages/
  video-assembly-shared/src/
    processor-spec.ts                        ProcessorJobSpec, ProcessorProviderKeys, ProcessorPresignedUrls
    processor-callbacks.ts                   ProcessorCompletePayload, ProcessorProgressPayload, ProcessorKeyFailurePayload
    assembly-types.ts                        misc shared types
    index.ts                                 videoJobAssemblyOutputKey(userId, jobId) helper

  external-video-processor/src/
    index.ts                                 Hono server — /health + /v1/process-spec
    pipeline/
      executor.ts                            executeJob — orchestrates stages + callbacks
      stages/
        script.ts                            runScriptStage, parseScriptJson, repairTruncatedJson
        prepare.ts                           runPrepareStage — images + TTS + sound → /tmp/
        assemble.ts                          runAssembleStage — FFmpeg + watermark + R2 PUT
      runner.ts                              in-memory job queue (dedup)
    providers/
      script-gen.ts                          callOpenRouterText + callGeminiText (max_tokens: 8192 ← NEEDS UPDATE)
      image-gen.ts                           SDXL via OpenRouter / Replicate
      tts-gen.ts                             Google TTS → Unreal Speech fallback
      sound-gen.ts                           ElevenLabs sound generation
    utils/
      callbacks.ts                           reportProgress / reportKeyFailure / reportComplete
      retry.ts                               withRetries + NonRetriableError
      r2-upload.ts                           uploadBufferToPresignedUrl (output.mp4 only)
      temp-file.ts                           tmpPath + cleanupFiles
      logger.ts                              structured logger (direct Axiom HTTP drain)
    ffmpeg/                                  concat.ts, mux.ts, probe.ts, segment.ts
    watermark/index.ts                       FFmpeg watermark overlay

public/
  llms.txt                                   comprehensive AI crawler docs

drizzle/                                     migration SQL files — always commit these
```

---

## Database Schema Summary

**Engine:** MySQL 8 (local Docker) / TiDB Cloud Serverless (prod)

| Table                 | Key columns                                                                                                                                                                                                                                                             |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `users`               | `id`, `email`, `plan` (free/starter/creator/empire), `creditsRemaining`, `creditsUsed`, `freeVideoConsumed`, `role` (user/admin), `banned`, `destinationReplacementsUsed`                                                                                               |
| `channels`            | `id`, `userId`, `name`, `niche`, `config` (JSON — tone/duration/aspect_ratio/auto_post/etc), `platform` (unlinked/youtube/tiktok/instagram), `oauthRefreshToken`, `boundExternalAccountId`, `soundEnabled`, `soundPromptHint`                                           |
| `video_jobs`          | `id`, `userId`, `channelId`, `pipelineKind`, `inputPayload` (JSON `{idea}`), `artifacts` (JSON `{scriptText?,title?,description?,tags[]}`), `status`, `progress`, `currentStage`, `costCredits`, `outputUrl`, `publishApprovalStatus`, `publishedVideoId`, `retryCount` |
| `schedules`           | `id`, `channelId`, `frequency`, `nextRunAt`, `jitterMinutes` (default 360), `enabled`, `lastRunAt`                                                                                                                                                                      |
| `provider_api_keys`   | `id`, `provider`, `secret`, `secretFingerprint`, `modelId`, `taskType` (any/script/image/tts/voice/sound), `cooldownUntil`, `disabled`, `failureCount`, `quotaResetAt`                                                                                                  |
| `credit_transactions` | `id`, `userId`, `type` (usage/purchase/refund), `amount`                                                                                                                                                                                                                |
| `expiring_assets`     | `id`, `userId`, `videoJobId`, `logicalKey`, `kind` (output/tts_intermediate/etc), `expiresAt`                                                                                                                                                                           |
| `usage_idempotency`   | `scope`, `clientKey` — prevents double credit charges on retry                                                                                                                                                                                                          |
| `site_settings`       | single-row global: `registrationEnabled`                                                                                                                                                                                                                                |

**`VideoJobArtifacts` type (JSON column `artifacts`):**

```ts
type VideoJobArtifacts = {
  scriptText?: string; // voiceover text (NOT raw JSON) — populated by processor complete callback
  title?: string; // AI-generated video title
  description?: string; // AI caption
  tags?: string[]; // lowercase, no # prefix, max 100
};
```

**`ChannelConfig` type (JSON column `config`):**

```ts
{
  tone: "dark" | "educational" | "fun"   // default: "educational"
  target_duration: number                 // seconds, 15–600, clamped by plan
  posting_frequency: "daily" | "every_2_days" | ... | "monthly"
  auto_post: boolean                      // false = require manual approval
  aspect_ratio: "16:9" | "9:16" | "1:1"  // default: "9:16"
  style_seed: number
  visual_identity: { primary_color, font_pair, caption_style }
}
```

---

## Job Lifecycle

```
queued
  └─ cron picks up → CAS queued→dispatched, currentStage=dispatch_pending
dispatched
  └─ POST /v1/process-spec → processor starts
processing
  └─ stage progress callbacks update progress/currentStage
completed  ← processor fires assembly-complete callback (status=completed)
  └─ if auto_post=false → publishApprovalStatus=pending (user must approve)
  └─ if auto_post=true  → immediately triggers YouTube upload
failed     ← processor fires assembly-complete callback (status=failed)
  └─ user can manually retry up to 3 times (retryCount)
```

**Stuck dispatch recovery:** cron re-dispatches if `status=dispatched` AND `stage=dispatch_pending` AND `updatedAt < now - 3min`. Max 10 dispatches per cron tick.

**409 `invalid_state` on complete callback:** means job was already in a terminal state when processor fired — safe to ignore (race with stuck-dispatch recovery). `executor.ts` now swallows this.

---

## AI Provider Stack

| Task   | Primary                                                     | Fallback                              |
| ------ | ----------------------------------------------------------- | ------------------------------------- |
| Script | OpenRouter (`models[]` array, OR handles internal fallback) | Gemini direct API                     |
| Images | OpenRouter FLUX.2 Pro (free)                                | Replicate FLUX Schnell (~$0.003/img)  |
| TTS    | Google Cloud TTS (1M Neural2 chars/month free)              | Unreal Speech (250K chars/month free) |
| Sound  | ElevenLabs (Creator+ only)                                  | —                                     |

**Script model chain** (env configurable):

- `OPENROUTER_SCRIPT_MODEL` default: `google/gemma-4-26b-a4b-it:free`
- `OPENROUTER_SCRIPT_FALLBACK_MODELS` default: `google/gemma-4-26b-a4b-it:free,nvidia/nemotron-nano-12b-v2-vl:free`
- Gemini fallback model: `GEMINI_SCRIPT_MODEL` / per-key `modelId` override, default `gemini-2.5-flash`

**Provider key system:**

- Keys stored in `provider_api_keys` table (DB), NOT env vars (env vars are materialized into DB on first use when row count = 0 for that provider)
- `executeWithProviderKeyRotation` — round-robin through active keys, exponential backoff `min(100ms × 2^i, 8000ms)`
- Cooldown types: rate_limit (429→90s), unavailable (503/408→45s), server_error (5xx→15s), auth_error (401/403→2min), quota/billing → until next UTC month or `Retry-After` header
- Keys bundled into `ProcessorJobSpec.providerKeys` before dispatch (processor never hits DB)
- `taskType` column pins keys to specific pipeline stages (any/script/image/tts/voice/sound)
- `modelId` column per-key overrides global model default

---

## Credits

| Operation           | Cost     |
| ------------------- | -------- |
| Script generation   | 5 (flat) |
| Image per image     | 2        |
| TTS per 1,000 chars | 4        |
| Video assembly      | 3 (flat) |
| AI video per second | 3        |

| Plan    | Monthly Credits        | Channels | Sound | Publishing |
| ------- | ---------------------- | -------- | ----- | ---------- |
| Free    | 0 (1 trial video only) | 1        | ❌    | ❌         |
| Starter | 1,500                  | 1        | ❌    | ✅         |
| Creator | 5,000                  | 3        | ✅    | ✅         |
| Empire  | 15,000                 | 20       | ✅    | ✅         |

Add-ons: small=750, large=2,000 credits (one-time).  
Destination replacements/cycle: free=0, starter=1, creator=5, empire=30.  
Schedule fast-forward: Creator+ only.  
Duration cap: free/starter=30s, creator=60s, empire=600s.

---

## Auth

Better Auth with:

- Email OTP: 6-digit, 10-min expiry, 5 attempts max. Local env: always `123456`
- Google OAuth: social sign-in
- Admin plugin: `user` (default) / `admin` roles. `ADMIN_EMAILS` env auto-promotes on login

**Registration kill switch (two independent gates, checked in `databaseHooks.user.create.before`):**

1. `REGISTRATION_ENABLED=false` env var (hard block)
2. `site_settings.registration_enabled=false` (admin dashboard toggle)

**Polar customer creation:** in `databaseHooks.user.create.after` (NOT `before`) — so Polar API never called if registration blocked. Sets `externalId = user.id`.

Admin `createUserAsAdmin` bypasses kill switch via `AsyncLocalStorage` context (`isAdminCreate()`).

---

## Publishing

Flow after job completes:

1. `runAfterVideoRenderComplete` called from webhook handler
2. Registers `expiring_assets` row for output.mp4 (free tier: ~24h TTL, paid: longer)
3. If channel `auto_post=false` → set `publishApprovalStatus=pending`, send email if `notifyVideoApproval=true`
4. If channel `auto_post=true` → `dispatchPlatformPublishAfterRender` → `runYoutubePublishForJob`
5. YouTube: refreshes OAuth token → builds metadata → `uploadMp4ToYoutube` (resumable upload)
6. On success: `publishedVideoId` set, `publishedAt` set
7. On OAuth failure: email sent to reconnect channel, `publishLastError` set

**Manual approve/reject:** `setPublishApprovalForUser` in `video-jobs.service.server.ts`.  
**Manual publish retry:** "Retry publish" button in job history → `requestPlatformPublishForJob`.  
**YouTube constraints:** tags total ≤500 chars (commas included), per-tag ≤30 chars → `fitTagsToYoutubeBudget`. `categoryId="22"` (People & Blogs) hardcoded.  
**TikTok/Instagram:** schema exists, not implemented — logs warning and skips.

---

## Cron Jobs

All protected by `Authorization: Bearer INTERNAL_CRON_SECRET`. Configured at cron-job.org or CF Cron Triggers.

| Route                                   | Frequency    | Does                                                                   |
| --------------------------------------- | ------------ | ---------------------------------------------------------------------- |
| `POST /api/cron/dispatch-queued-jobs`   | every 1 min  | picks queued + stuck-dispatched jobs (max 10), sends to processor      |
| `POST /api/cron/trigger-scheduled-jobs` | per schedule | fires channels where `nextRunAt <= now`, advances `nextRunAt` + jitter |
| `POST /api/cron/purge-expiring-assets`  | daily        | deletes R2 objects + DB rows where `expiresAt <= now`                  |

---

## TiDB `ONLY_FULL_GROUP_BY` Gotcha

**Always ON** in TiDB Cloud Serverless. Drizzle ORM renders the same `sql`` tagged template object differently per SQL clause context:

- In `SELECT`: column unqualified → `DATE(\`created_at\`)`
- In `GROUP BY`: column table-qualified → `DATE(\`video_jobs\`.\`created_at\`)`

TiDB rejects this as mismatched GROUP BY. **Do not use SQL functions in GROUP BY with Drizzle.** Workaround: fetch raw rows, aggregate in JS.

Fixed example (`analytics.service.server.ts`):

```ts
// ✅ Correct — no GROUP BY, JS-side aggregation
const rawRows = await db.select({ createdAt: videoJobs.createdAt }).from(videoJobs).where(...);
const countByDate = new Map<string, number>();
for (const r of rawRows) {
  const d = r.createdAt.toISOString().slice(0, 10);
  countByDate.set(d, (countByDate.get(d) ?? 0) + 1);
}
```

---

## Cursor Pagination Pattern

Used on: `/dashboard/jobs`, `/admin/jobs`, `/admin/users`.  
**Admin users** still runs `COUNT(*)` (with searchFilter only, not cursor) for `total` shown in StatCard.

**Server:**

```ts
const whereCondition = cursor
  ? and(
      eq(table.userId, userId),
      or(
        lt(table.createdAt, cursor.createdAt),
        and(eq(table.createdAt, cursor.createdAt), lt(table.id, cursor.id)),
      ),
    )
  : eq(table.userId, userId);

const rows = await db.select(...)
  .where(whereCondition)
  .orderBy(desc(table.createdAt), desc(table.id))
  .limit(pageSize + 1);  // +1 to detect next page

const hasNext = rows.length > pageSize;
const items = hasNext ? rows.slice(0, pageSize) : rows;
const last = items[items.length - 1];
const nextCursor = hasNext && last ? { createdAt: last.createdAt, id: last.id } : null;
```

**Client (React):**

```ts
const [cursorStack, setCursorStack] = useState<Cursor[]>([]);
const currentCursor = cursorStack[cursorStack.length - 1]; // undefined = page 1
const currentPage = cursorStack.length + 1;

// Next:                setCursorStack(prev => [...prev, nextCursor])
// Prev:                setCursorStack(prev => prev.slice(0, -1))
// Reset (filter etc):  setCursorStack([])
```

TanStack Query key: `["my-resource", cursor ?? null, pageSize]` — each page cached independently. `useQuery` not `useInfiniteQuery` (cursor stack handles back-nav, not infinite scroll).

Cursor JSON transport: `createdAt` serialized as ISO string (Date → string → Date conversion in server fn).

---

## ProcessorJobSpec Shape

Key fields sent from main app to processor:

```ts
{
  jobId, userId, channelId,
  scriptSystemPrompt,           // pre-built system prompt (shortForm or longForm)
  scriptUserPrompt,             // pre-built user prompt (channel brief + idea)
  openrouterScriptModels,       // ["primary", "fallback1", "fallback2"]
  ttsVoice,                     // Unreal Speech voice ID
  targetDuration,               // seconds (clamped by plan)
  aspectRatio,                  // "9:16" | "16:9" | "1:1"
  soundPrompt,                  // null = no sound; string = ElevenLabs prompt
  soundDurationSeconds,         // capped at 22s
  freeTierWatermark,            // true = overlay "Klipse" text
  watermarkLabel,               // label text
  providerKeys: {               // all keys bundled — processor never hits DB
    openrouter: [...],
    googleTts: [...],
    replicate: [...],
    unrealSpeech: [...],
    elevenlabs: [...],
    gemini: [...],
  },
  presignedUrls: {
    outputVideo: string,        // presigned PUT URL for output.mp4 (1h TTL)
    // NO ttsAudio / images / soundAudio — intermediates stay in /tmp/
  },
  callbackBaseUrl,              // e.g. https://klipse.app
  callbackSecret,               // VIDEO_PROCESSOR_WEBHOOK_SECRET
}
```

---

## Processor Callback Flow

Three callback paths from processor → main app:

1. `POST /api/internal/processor/progress` — `{ jobId, stage, progress }` — updates DB progress/stage (swallowed on failure, non-blocking)
2. `POST /api/internal/processor/key-failure` — `{ jobId, provider, keyId, httpStatus, bodySnippet, retryAfterHeader }` — main app classifies failure, sets `cooldownUntil` on the key row
3. `POST /api/internal/video-processor/assembly-complete` — `{ jobId, userId, status, error?, scriptText?, title?, description?, tags? }` — terminal result; Zod validated; marks job completed/failed; writes artifacts

**assembly-complete Zod schema:**

```ts
{
  jobId: z.string().trim().min(1).max(64),
  userId: z.string().trim().min(1).max(64),
  status: z.enum(["completed", "failed"]),
  error: z.string().max(4000).optional(),
  scriptText: z.string().max(50000).optional(),
  title: z.string().max(100).optional(),
  description: z.string().max(2000).optional(),
  tags: z.array(z.string().max(50)).max(100).optional(),
}
```

**`applyVideoProcessorWebhook` idempotency:**

- Same terminal state = `{ ok: true, replayed: true }` (200)
- Mismatched terminal states = `{ ok: false, code: "invalid_state" }` (409) — race condition, normal
- Job not in `dispatched` or `processing` = `{ ok: false, code: "invalid_state" }` (409)
- DB update uses `inArray(status, ["dispatched", "processing"])` as CAS guard

---

## Script Stage JSON Parsing

`parseScriptJson(raw)` tries candidates in order:

1. Raw string as-is → `JSON.parse`
2. Strip markdown code fences ` ```json ... ``` `
3. Slice from first `{` to last `}` (handles prose preamble/postamble)
4. `repairTruncatedJson(raw.slice(firstBrace))` — closes open strings, strips trailing comma, balances `{[` stack

`repairTruncatedJson` logic:

- Walk chars tracking string/escape state → if in open string at end, append `"`
- Remove trailing `,` before closers
- Walk again tracking bracket depth → append missing `]` and `}` from stack

**isScriptJson guard:** requires `typeof voiceover === "string"` AND `Array.isArray(imagePrompts)`.

`ScriptJson`:

```ts
{ voiceover: string; imagePrompts: unknown[]; title?: string; description?: string; tags?: string[] }
```

On parse success: `ttsText` = cleaned/truncated voiceover, `tags.slice(0, 100)`.
On parse fail: `ttsText = sanitizeForTts(raw)` (tag/regex fallback path), `title/description/tags` unavailable.

`scriptMarkdown` (stored as `artifacts.scriptText`) = `ttsText` (NOT `raw`). `firstLineFromScript(scriptText)` extracts first non-empty line as YouTube title fallback.

---

## Retry / Callback Error Handling

`NonRetriableError` (`retry.ts`) — `withRetries` breaks immediately on first throw (no backoff wasted).

`postCallback` (`callbacks.ts`) — 4xx response → throws `NonRetriableError(msg)`. 5xx/network → throws regular Error (retried).

`reportComplete` retry attempts: 8 (`COMPLETE_ATTEMPTS`).  
`reportProgress` retry attempts: 3 (`PROGRESS_ATTEMPTS`).  
`reportKeyFailure` retry attempts: 5 (`FAILURE_ATTEMPTS`).

`executeJob` complete-callback error handling:

```ts
await reportComplete(spec, "completed", ...).catch((e) => {
  if (e.message.includes("callback_409")) {
    logger.warn("complete_callback_invalid_state", { jobId });
    return; // DO NOT escalate to failure callback — video encoded OK
  }
  throw e; // real failures re-throw → caught → failure callback
});
```

---

## YouTube Metadata Building

`buildYoutubeVideoMetadata` title priority:

1. `artifacts.title` (AI-generated)
2. `firstLineFromScript(artifacts.scriptText)` (first voiceover sentence, ≤80 chars)
3. `inputPayload.idea.slice(0, 72)` (user idea)
4. `${channelName} — video` (fallback)

Title capped at 100 chars. Description capped at 5000 chars. Hashtags built from all tags (`#tagname`), appended to description.

`fitTagsToYoutubeBudget(tags, budget=500)`:

- YouTube total tag chars ≤500 (commas included), per-tag ≤30
- Iterates tags, tracks used chars, stops when budget exceeded
- Returns subset that fits

`categoryId: "22"` hardcoded (People & Blogs). Could be per-channel config — not yet.

---

## Environment Variables

Minimum for local dev (see `.env.example` for full list):

```bash
DATABASE_URL="mysql://klipse:klipse@localhost:3306/klipse"
BETTER_AUTH_SECRET=          # npx -y @better-auth/cli secret
BETTER_AUTH_URL=http://localhost:3000
SERVER_URL=http://localhost:3000
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
YOUTUBE_OAUTH_STATE_SECRET=  # openssl rand -hex 32
INTERNAL_CRON_SECRET=
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_BASE_URL=
APP_PUBLIC_URL=http://host.docker.internal:3000  # for processor → host callbacks
VIDEO_PROCESSOR_URL=http://localhost:8790
VIDEO_PROCESSOR_CLIENT_SECRET=   # openssl rand -hex 32
VIDEO_PROCESSOR_WEBHOOK_SECRET=  # openssl rand -hex 32
RESEND_API_KEY=
EMAIL_FROM=
POLAR_WEBHOOK_SECRET=
POLAR_ACCESS_TOKEN=
POLAR_SERVER=sandbox
POLAR_PRODUCT_STARTER=
POLAR_PRODUCT_CREATOR=
POLAR_PRODUCT_EMPIRE=
POLAR_PRODUCT_CREDITS=
POLAR_PRODUCT_CREDITS_LARGE=
ADMIN_EMAILS=                 # comma-separated, auto-promoted to admin on login
REGISTRATION_ENABLED=true
VITE_REGISTRATION_ENABLED=true
DISCORD_BUG_REPORT_WEBHOOK_URL=  # required by env schema even in dev
```

AI keys (comma-separated, materialized into DB on first use):

```bash
OPENROUTER_API_KEYS=
OPENROUTER_SCRIPT_MODEL=google/gemma-4-26b-a4b-it:free
OPENROUTER_SCRIPT_FALLBACK_MODELS=google/gemma-4-26b-a4b-it:free,nvidia/nemotron-nano-12b-v2-vl:free
GEMINI_API_KEYS=
GEMINI_SCRIPT_MODEL=gemini-2.5-flash
GOOGLE_TTS_API_KEYS=
GOOGLE_TTS_VOICE_NAME=en-US-Wavenet-G
UNREAL_SPEECH_API_KEYS=
ELEVENLABS_API_KEYS=
REPLICATE_API_KEYS=
```

Observability:

```bash
AXIOM_API_TOKEN=
AXIOM_DATASET=klipse
SENTRY_DSN=
VITE_APP_SENTRY_DSN=
SENTRY_AUTH_TOKEN=
KLIPSE_PERF_LOG=1            # enable info-level logs in production (in wrangler.jsonc vars)
```

---

## Dev Commands

```bash
# Main app
pnpm dev                      # :3000
pnpm build                    # runs db:migrate first (prebuild)
pnpm deploy                   # build + wrangler deploy
pnpm check                    # Biome lint+format (run before commit)
pnpm check --write            # auto-fix
pnpm test                     # Vitest

# Database
pnpm db:setup                 # Docker Compose MySQL (wipes + restarts)
pnpm db:generate              # generate migration from schema changes
pnpm db:migrate               # apply pending migrations
pnpm db:push                  # direct schema push (dev only, no migration file)
pnpm db:studio                # Drizzle Studio GUI

# Processor
pnpm processor:docker:up      # build + start container :8790
pnpm processor:docker:down    # stop
pnpm processor:docker:logs    # stream logs
pnpm processor:docker:setup   # down + up (full restart)
pnpm processor:typecheck      # tsc --noEmit
pnpm worker:typecheck         # tsc --noEmit on main app
```

**Local OTP:** always `123456` when `ENVIRONMENT=local` or `development`.

---

## Logging Conventions

```ts
import { logger } from "@/lib/logger";
logger.info("event_name", { key: "value" });  // emitted when KLIPSE_PERF_LOG=1 or non-prod
logger.warn("event_name", { ... });           // always emitted
logger.error("event_name", { ... });          // always emitted
```

**Never use `console.*`** — always `logger.*`.  
`LogContext.status` is typed `number` (HTTP code). Use `jobStatus` for string job statuses.  
Processor uses separate logger with direct Axiom HTTP drain.

---

## Recent Changes (all committed to main)

### Tags: 10 → 100 — `0070d76`, `d0ebbf4`, `3dbdc2e`

- System prompts updated: "minimum 100 lowercase tags"
- `assembly-complete.ts` Zod: `.max(100)` on tags
- `script.ts`: `.slice(0, 100)` in processor before sending

### YouTube tags budget — `ca88887`

- Old: `.slice(0, 30)` tags — arbitrary, didn't respect 500-char limit
- New: `fitTagsToYoutubeBudget(tags, budget=500)` in `youtube-upload-api.server.ts`
- Per-tag still capped at 30 chars; stops adding when total chars would exceed 500

### Analytics chart — `b2f0dce`

- Broken: SQL `DATE()` GROUP BY → TiDB ONLY_FULL_GROUP_BY rejection
- Fixed: JS-side aggregation, no GROUP BY in SQL at all
- Bounded to ~750 rows / 30 days (Empire tier max), safe for in-memory

### Cursor pagination — `4067893`, `ea371a7`

- Replaced offset pagination on `/dashboard/jobs`, `/admin/jobs`, `/admin/users`
- `CursorPagination` component in `src/components/shared/pagination.tsx`
- `videoJobsQueryOptions(cursor?, pageSize?)` in `src/lib/queries/dashboard-queries.ts`

### False failure cascade fix — `bdd2eee`

**Root cause:** processor completed encoding → fired `reportComplete(completed)` → got `409 invalid_state` (job re-dispatched by stuck-recovery, already terminal) → `withRetries` retried 8× wasting ~2 min → threw → `executeJob` catch fired `reportComplete(failed)` → job marked failed despite successful encode.

- `retry.ts`: `NonRetriableError` class; `withRetries` breaks immediately
- `callbacks.ts`: 4xx → `NonRetriableError` (no retry)
- `executor.ts`: `409` on completed callback → `logger.warn` + return, no failure escalation

### scriptText storing raw JSON — `15b98f0` (partial)

- Bug: `scriptMarkdown: raw` where `raw` = full LLM JSON blob → stored as `artifacts.scriptText`
- `firstLineFromScript` was getting `{"voiceover":` as YouTube title fallback
- Fix: `scriptMarkdown: ttsText` (cleaned voiceover text only)

### Robust JSON parsing + truncation repair — `15b98f0`

- `parseScriptJson` candidates: raw → code-fence strip → `{first...last}` extraction → `repairTruncatedJson`
- `repairTruncatedJson`: close open string → strip trailing comma → balance brackets
- `tags.slice(0, 100)` added in processor script stage

### llms.txt — `dfbb74b`

- `public/llms.txt` — AI crawler docs, served at `https://klipse.app/llms.txt`

---

## Next Actions

1. **Optional** — expose `categoryId` as per-channel config (currently hardcoded `"22"` in `youtube-upload-api.server.ts`)
