# Klipse Cloudflare Worker

Async jobs for Klipse: [Queues](https://developers.cloudflare.com/queues/) (reliable delivery) + [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/) (backup sweeps). **Heavy work stays out of the TanStack request thread**; this Worker forwards to the main app’s internal APIs (DB + Polar live on the server only).

## Layout

- `src/index.ts` — HTTP (`/health`, `/enqueue`) + queue consumer + `scheduled` cron.
- `src/dispatch.ts` — map queue bodies → handlers (add new job kinds here).
- `src/call-main-drain.ts` — authenticated `fetch` to the main app.
- Shared message shapes: `packages/worker-contracts` (workspace dependency).

## One-time Cloudflare setup

1. Create the queue (name must match `wrangler.toml`):

   ```bash
   wrangler queues create klipse-jobs
   ```

2. Set secrets (production):

   ```bash
   wrangler secret put WORKER_SECRET
   ```

   Use the **same** value as `WORKER_SECRET` in the main app `.env`.

3. Set `MAIN_APP_URL` for production (Wrangler dashboard or `wrangler.toml` env block) to your public TanStack origin, e.g. `https://app.example.com`.

## Local development

1. Main app: `pnpm dev` (port 3000).
2. Copy `workers/klipse-worker/.dev.vars.example` → `.dev.vars` and set `WORKER_SECRET` to match the main app.
3. Worker: `cd workers/klipse-worker && pnpm dev` (default port 8787).

The main app’s `WORKER_API_URL` should be `http://127.0.0.1:8787`. Set **`ENVIRONMENT=local`** in the main app `.env.local` so that if the Worker is down, the app **falls back** to an in-process Polar outbox drain and video dispatch (dev only). With `production` (default), a failed enqueue does **not** run pipelines inline.

## Deploy

```bash
cd workers/klipse-worker && pnpm deploy
```
