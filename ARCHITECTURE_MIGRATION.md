# EveBash Architecture Migration

Target: Vercel handles presentation/frontend. Railway handles the main business backend/API.

## Completed Pilot Flows

| Flow | Preferred Railway route | Next.js status | Client status |
| --- | --- | --- | --- |
| Contact messages | `/api/v1/contact-messages` | Compatibility proxy only | Web/mobile use v1 route |
| Pricing plans read | `/api/v1/pricing-plans` | Compatibility proxy only | Web/dashboard use v1 route |
| Apply pending subscription | `/api/v1/subscriptions/apply-pending` | Compatibility proxy only | Web auth uses v1 route |

## Remaining Next.js Backend Areas

| Area | Current Next route group | Target owner |
| --- | --- | --- |
| Payments | `/api/create-order`, `/api/verify-payment` | Railway |
| Media uploads | `/api/media/*` | Railway orchestration, Backblaze direct upload |
| Media jobs | `/api/media/process-thumbnail`, `/api/media/trigger-modal-batch`, `/api/debug/video-trigger` | Railway + QStash + Modal |
| Find You | `/api/find-you*` | Railway + Modal |
| Subscription changes | `/api/subscription/*` | Partially migrated to Railway |
| Admin billing/control | `/api/admin/*` | Railway |

## Migration Rule

For each flow:

1. Build or harden the Railway endpoint.
2. Switch web/mobile/dashboard clients to the Railway `/api/v1` route.
3. Keep the old Next route as a temporary proxy only if needed for compatibility.
4. Verify staging.
5. Remove the obsolete Next proxy after all clients use Railway directly.
