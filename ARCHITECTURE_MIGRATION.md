# EveBash Architecture Migration

Target Architecture: Vercel handles presentation/frontend. Railway handles the main business backend/API (`@evebash/backend`).

## Completed Pilot Flows

| Flow | Preferred Railway route | Next.js status | Client status |
| --- | --- | --- | --- |
| Contact messages | `/api/v1/contact-messages` | Compatibility proxy only | Web/mobile use v1 route |
| Pricing plans read | `/api/v1/pricing-plans` | Compatibility proxy only | Web/dashboard use v1 route |
| Apply pending subscription | `/api/v1/subscriptions/apply-pending` | Compatibility proxy only | Web auth uses v1 route |
| Media indexing status | `/api/v1/media/indexing-status` | Compatibility proxy only | Web/mobile use v1 route |
| Payments | `/api/v1/payments/create-order`, `/api/v1/payments/verify-payment` | Compatibility proxy only | Web checkout uses v1 route / proxy |
| Media uploads & storage | `/api/v1/media/*` (presigned URLs, chunked uploads, saving & deletion) | Compatibility proxy only | Web/mobile use v1 route / proxy |
| Find You AI face search | `/api/find-you` & `/api/find-you/index-face` | Compatibility proxy only | Web/mobile use v1 route / proxy |
| Admin control & billing metrics | `/api/admin/control`, `/api/admin/*-billing`, `/api/admin/backblaze-usage` | Compatibility proxy only | Web admin dashboard uses Railway |
| Media background jobs | `/api/v1/media/process-thumbnail`, `trigger-modal-batch`, `retry-resizing`, `rotate` | Compatibility proxy only | QStash & background workers use Railway |

## Backend Status Summary

100% of API endpoints and business logic are now deployed to and owned by the Railway Express backend (`@evebash/backend`).
Next.js serverless API routes function strictly as lightweight compatibility proxies.
