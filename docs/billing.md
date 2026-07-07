# Billing & Credits

Klipse uses **Polar** for subscription management and usage-based billing. Credits are the internal unit for metering; Polar meters the sum of credits consumed.

---

## Subscription Tiers

| Tier | Monthly Credits | Channels | Publishing |
|---|---|---|---|
| Free | — (no recurring credits) | 1 | ❌ (generate only) |
| Starter | 1,500 | 1 | ✅ |
| Creator | 5,000 | 3 | ✅ |
| Empire | 15,000 | 20 | ✅ |

(The "AI background sound" Creator+ perk was removed — the self-hosted video model generates audio natively for every job now, it was never a separate toggleable add-on.)

**Destination replacements per billing cycle** (how many times a user can swap the connected publishing account on an existing channel slot):

| Tier | Replacements |
|---|---|
| Free | 0 (cannot connect paid publishing) |
| Starter | 1 |
| Creator | 5 |
| Empire | 30 |

---

## Credit Costs

Defined in `src/features/billing/credit-costs.ts`:

| Operation | Cost |
|---|---|
| Script generation | 5 credits |
| AI video (per second) | 3 credits |

One self-hosted model call now covers what used to be three separate line items (image/TTS/assembly), which are retired. Credits are deducted **at job creation** (not on completion), based on the resolved `targetDuration`, not the actual generated duration. If a job fails, credits are not automatically refunded — manual admin action required.

---

## Credit Add-Ons

One-time credit packs purchasable independently of subscription tier:

| Pack | Credits |
|---|---|
| Small (1k) | 750 credits |
| Large (3k) | 2,000 credits |

Product IDs set via `POLAR_PRODUCT_CREDITS` and `POLAR_PRODUCT_CREDITS_LARGE` env vars.

---

## Polar Setup

### 1. Create Products

In the Polar dashboard, create the following products:

- **Starter** — monthly subscription
- **Creator** — monthly subscription
- **Empire** — monthly subscription
- **Credits 1k** — one-time purchase
- **Credits 3k** — one-time purchase

Copy each product ID into the corresponding `POLAR_PRODUCT_*` env var.

### 2. Create Usage Meter

In Polar dashboard → Usage → Meters:

- **Name:** `klipse.usage`
- **Aggregation:** Sum
- **Metadata key:** `credits`

> Use **Sum** not Count — each job reports a weighted credit amount, not a flat "1 event".

### 3. Configure Webhook

In Polar dashboard → Webhooks:

- **URL:** `https://<your-domain>/api/auth/polar/webhooks`
- **Events:** `subscription.active`, `subscription.revoked`, `order.paid`
- Copy the webhook secret to `POLAR_WEBHOOK_SECRET` env var

### 4. Local Development

Use the Polar CLI to forward webhooks locally:

```bash
polar listen http://localhost:3000/api/auth/polar/webhooks
```

Set `POLAR_SERVER=sandbox` for test mode.

---

## How Credits Flow

```
Job created
    │
    ├── Check user credit balance
    ├── Deduct credits (DB transaction)
    ├── Record credit_transaction row
    └── Report to Polar usage meter
         └── POST /api/auth/polar/ingest
              └── { event: "klipse.usage", metadata: { credits: N } }
```

Credit deduction and Polar metering happen atomically at job creation via `content-pipeline-execute.server.ts`. Polar aggregates these events and bills the user's subscription at end of cycle.

---

## Polar Webhook Handlers

`src/features/billing/polar-sync.server.ts`:

| Event | Handler | What it does |
|---|---|---|
| `subscription.active` | `handlePolarSubscriptionActive` | Sets user `plan` column, resets monthly credits |
| `subscription.revoked` | `handlePolarSubscriptionRevoked` | Downgrades user to `free` plan |
| `order.paid` | `handlePolarOrderPaid` | Adds credits for one-time credit pack purchases |

---

## Polar Customer Lifecycle

**On user registration:**
- Better Auth fires `databaseHooks.user.create.after`
- Checks Polar for existing customer by email (handles guest checkout before registration)
- Creates or links Polar customer with `externalId = user.id`

**Why `after` not `before`:**
Registration can be blocked by kill switch (`REGISTRATION_ENABLED=false`). Using `after` ensures Polar API is only called after the user row is actually committed — no orphaned Polar customers if registration is blocked.

---

## Admin Controls

### Registration Kill Switch

Two independent gates:

1. **Env var** (`REGISTRATION_ENABLED=false`) — hard block, wins over DB setting
2. **DB toggle** (`site_settings.registration_enabled = false`) — toggled from admin dashboard

Both checked in `databaseHooks.user.create.before`. Either alone is sufficient to block registration.

### Credit Adjustment

Directly update `users.credits` and insert a `credit_transactions` row for audit trail. No automated refund flow — manual admin action.

---

## Entitlement Checks

`src/features/entitlements/` — gating functions used throughout the app:

- `planAllowsPaidPublishingConnections(plan)` — free tier cannot connect YouTube/TikTok
- `planAllowsScheduleFastForward(plan)` — Creator+ only
- `clampTargetDuration(duration, plan)` — caps video length per plan
