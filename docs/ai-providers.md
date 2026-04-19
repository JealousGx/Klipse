# AI Provider Key Management

Klipse uses a DB-backed key pool for all AI providers. Keys live in `provider_api_keys` table, not hardcoded. This enables cooldown tracking, failure counting, per-key model overrides, and task pinning — all without code deploys.

---

## Providers

| Provider | Use | Env fallback var |
|---|---|---|
| `gemini` | Script generation (LLM) — primary | `GEMINI_API_KEYS` |
| `openrouter` | Script generation — fallback | `OPENROUTER_API_KEYS` |
| `google_tts` | Text-to-Speech — primary | `GOOGLE_TTS_API_KEYS` |
| `unreal_speech` | TTS fallback | `UNREAL_SPEECH_API_KEYS` |
| `elevenlabs` | Sound effects (Creator+ only) | `ELEVENLABS_API_KEYS` |
| `replicate` | Image generation (SDXL default; FLUX supported) | `REPLICATE_API_KEYS` |

---

## How Keys Are Loaded

**Two-tier materialization:**

1. On first use of a provider, the system checks if any rows exist in `provider_api_keys` for that provider.
2. If zero rows → env var is read, each comma-separated key is inserted as a DB row.
3. From that point on, only DB rows are used. Env var changes require manually updating DB rows.

This means:
- Add a new key → insert into `provider_api_keys` (admin dashboard or direct SQL)
- Rotate a key → update the `secret` column on the existing row
- Remove a key → set `disabled = true`

**Bulk load (processor):** `listAllProcessorProviderKeyCredentials()` fetches all 6 providers in 2 queries instead of 12 — one grouped count to detect missing providers, one bulk SELECT.

---

## Key Selection Logic

`listProviderApiKeyCredentials(provider, taskType?)`:

1. **Query 1:** Active keys — `cooldownUntil IS NULL OR cooldownUntil < NOW()`. Return these if any exist.
2. **Query 2 (fallback):** All non-disabled keys, even cooled-down ones. Tried anyway — will fail and re-enter cooldown. Prevents full stall when all keys are exhausted.

Keys ordered by `sortOrder ASC, id ASC`. Lower `sortOrder` = higher priority.

---

## Key Rotation on Failure

`executeWithProviderKeyRotation(provider, executeOne, options?)`:

- Loads credentials, shuffles via round-robin pool
- Tries each key in order with **exponential backoff** between attempts: `min(100ms × 2^i, 8000ms)`
- On `ProviderHttpError`: classifies failure → if rotatable, records cooldown and continues to next key
- On success: clears cooldown (`clearCooldownAfterSuccessfulUse`)
- If all keys exhausted: throws `<provider>_all_keys_exhausted`

---

## Failure Classification

`classifyProviderHttpFailure(error, { quotaResetAt })`:

| HTTP Status | Classification | Cooldown type |
|---|---|---|
| `401` | `auth_error` | Long (until next UTC month or parsed reset) |
| `402` | `payment_required` | Long |
| `403` + quota body | `quota_exhausted` | Long |
| `403` | `forbidden` | Short (2 min) |
| `429` + quota body | `quota_exhausted` | Long |
| `429` | `rate_limit` | Short (90s) |
| `408` | `timeout` | Short (45s) |
| `503` | `unavailable` | Short (45s) |
| `5xx` | `server_error` | Short (15s) |
| Other | — | Not rotated |

**Long cooldown** = `persistQuotaResetAt: true` → `quota_reset_at` column updated. Uses:
1. `Retry-After` header (if present)
2. `quota_reset_at` already on the row (from prior reset parse)
3. Next UTC month midnight as final fallback

---

## Task Pinning

Each key row has a `task_type` column: `any | script | tts | images | sound`.

- `any` = eligible for all tasks (default for env-materialized keys)
- Specific task = only eligible when that task requests it

Use to pin expensive keys to specific stages, e.g. a Gemini key exclusively for `script` tasks.

**Pass `taskType` when calling:**

```ts
await listProviderApiKeyCredentials("google_tts", "tts");
// Returns keys where taskType = 'any' OR taskType = 'tts'
```

---

## Per-Key Model Override

`provider_api_keys.model_id` — when set, processors use this model instead of the global default.

Example: pin a Gemini key to `gemini-2.5-flash` while another key uses `gemini-2.0-flash`.

---

## DB Schema Reference

```sql
provider_api_keys (
  id              varchar(64) PK,
  provider        varchar(32),          -- 'openrouter' | 'gemini' | 'google_tts' | ...
  secret          text,                 -- API key value
  secret_fingerprint varchar(64),       -- SHA-256 prefix for dedup
  task_type       enum('any','script','tts','images','sound'),
  model_id        varchar(128),         -- per-key model override (nullable)
  sort_order      int,                  -- lower = higher priority
  disabled        boolean,
  failure_count   int,
  cooldown_until  datetime(3),          -- NULL = active
  last_failure_at datetime(3),
  error_type      varchar(64),          -- last failure classification
  quota_reset_at  datetime(3),          -- known next quota reset (long cooldown)
  created_at      datetime(3),
  updated_at      datetime(3)
)
```

---

## External Processor Callback

When the processor reports a key failure via `POST /api/internal/processor/key-failure`:

```json
{
  "jobId": "...",
  "provider": "openrouter",
  "keyId": "...",
  "httpStatus": 429,
  "bodySnippet": "Rate limit exceeded",
  "retryAfterHeader": "60"
}
```

The app classifies the failure and updates cooldown — same logic as in-process rotation. This keeps DB cooldown state accurate even for provider errors that happen inside the external encoder.

---

## Common Issues

**All keys showing as cooled down:**
- Check `cooldown_until` column in `provider_api_keys`
- System will still try them (query 2 fallback) — they will likely fail again
- Fix: update `disabled = false`, clear `cooldown_until = NULL` if cooldown is stale

**Keys not appearing after env var update:**
- Env vars only materialize once (when row count = 0 for that provider)
- If rows already exist, env var changes are ignored
- Fix: insert new row directly or update existing `secret` column

**`<provider>_no_api_keys` error:**
- No rows in `provider_api_keys` for that provider AND no env var set
- Fix: add keys via admin dashboard or set env var and restart to trigger materialization
