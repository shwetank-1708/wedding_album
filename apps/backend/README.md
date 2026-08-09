# EveBash Railway Backend

Standalone Express service for EveBash API, worker orchestration, and privileged
admin operations. The web frontend remains on Vercel and calls this service via
`NEXT_PUBLIC_API_URL`. Mobile uses `EXPO_PUBLIC_API_BASE_URL`, and the analytics
dashboard uses `VITE_API_BASE_URL`.

## Routes

- `GET /health`
- `POST /api/contact-messages`
- `GET /api/pricing-plans`
- `/api/media/*` for upload, multipart upload, save, delete, rotate, thumbnails,
  indexing status, and Modal/QStash triggers
- `POST /api/find-you` and `POST /api/find-you/index-face`
- `POST /api/subscription/apply-pending`
- `POST /api/subscription/apply-due`
- `POST /api/admin/control`
- `GET /api/admin/supabase-billing`
- `GET /api/admin/cloudflare-billing`
- `GET /api/admin/backblaze-usage`
- `GET /api/admin/railway-billing`

The subscription payment creation and verification routes remain in Next.js
during this incremental migration. Move them only with a separate Razorpay
webhook and payment verification cutover.

## Local dev

```sh
npm install --prefix apps/backend
npm --prefix apps/backend run dev
```

## Railway

Use `apps/backend` as the Railway service root. Set the start command to:

```sh
npm start
```

Set `API_BASE_URL` to the public Railway API URL, for example
`https://api-staging.evebash.com`. This makes delayed QStash jobs call Railway
instead of the frontend deployment.

Copy the variables in `.env.example` into the Railway service. Keep service-role,
management, storage, Cloudflare, Railway, QStash, Modal, and cron credentials on
Railway only. Do not expose those values through `NEXT_PUBLIC_*`, `EXPO_PUBLIC_*`,
or `VITE_*` names.

Set a long random `INTERNAL_JOB_SECRET` in Railway. QStash thumbnail and delayed
indexing callbacks forward this value as a bearer token. Keep the same value in
any temporary Vercel fallback environment until those handlers are retired.

## Scheduled plan processing

Call the following endpoint from Railway Cron or QStash on the desired schedule:

```text
POST /api/subscription/apply-due
Authorization: Bearer <CRON_SECRET>
```

The endpoint applies all plan changes whose `pending_plan_effective_at` time has
arrived. Use a long random `CRON_SECRET` and store it only in Railway and the
scheduler.
