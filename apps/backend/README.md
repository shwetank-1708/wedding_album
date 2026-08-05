# EveBash Backend

Standalone backend service intended for Railway.

## First migrated routes

- `GET /health`
- `POST /api/contact-messages`
- `GET /api/pricing-plans`

Keep the existing Next.js API routes during migration. Move routes here incrementally, then point the frontend to this service with `NEXT_PUBLIC_API_URL`.

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
