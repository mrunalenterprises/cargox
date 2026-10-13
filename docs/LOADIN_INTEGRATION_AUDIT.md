# LOADIN Integration Audit

Date: 2026-10-13
Branch: `loadin-build`

## Current repository health

LOADIN is no longer at scaffold-only stage. The branch now contains working Customer, Partner, Admin and Fleet web surfaces, domain logic, a complete fresh-database migration chain, secure production RPCs, payment/notification workers, live tracking adapters, authentication, production readiness checks and deployment contracts.

Latest schema chain: **001 through 048**, contiguous by filename order.

The previous finding that migrations 001–008 were missing is resolved. Those foundation migrations are present and fresh PostgreSQL CI applies the complete chain in order.

## Production application surfaces

- Customer: booking, Fare Lock, trip status, cancellation, support/SOS, tracking, payment mode, online payment orchestration, recurring routes, business account, rewards/favourite, reliability/cargo proof, Full Shifting, notifications and account/security.
- Partner: onboarding, private documents, expiry/compliance, fresh identity selfie gate, online/offline, dispatch offers, trip lifecycle, proof, GPS sharing, earnings, wallet/payout, plan comparison, Return Load/replacement, notifications and quality/demand.
- Admin: dashboard, live ops/map, booking detail, partner review, document renewal, finance/payout, safety/fraud, growth, support SLA, city/service control, staff/audit and production readiness.
- Fleet: snapshot, vehicles/drivers/assignments, compliance, reports, planner and dispatch board.

## Secure backend layers

### Supabase RPC/database
Browser-facing privileged flows use authenticated, scoped database RPCs. Admin roles/city scope and Fleet ownership are enforced in database functions. Anonymous execution for privileged functions is revoked.

### Portal API
`services/portal-api/worker.mjs` now provides a deployable HTTPS API for Admin/Fleet reads and selected mutations:
- `/dashboard`
- `/fleet/me`
- `/admin/support/:id/resolve`
- `/admin/city-service-status`

The service forwards the signed-in user's JWT to Supabase and uses only the public anon key. It adds exact browser-origin allow-listing, request body limits, JSON validation, readiness/liveness endpoints and contract tests. It does **not** require a service-role key.

### Payment worker
`services/payment-worker/worker.mjs` implements provider-neutral online-payment orchestration with Razorpay support, server-side order creation, signed webhook verification, idempotent event handling, amount validation, strict browser CORS and request-body protections.

### Notification worker
`services/notification-worker/worker.mjs` claims queued notifications, sends FCM messages using service-account OAuth, records delivery outcomes and refreshes document compliance.

## Browser runtime security

Runtime configuration is centralized and generated from public-only `LOADIN_PUBLIC_*` values. CI rejects secret-like values in generated browser config and prevents direct config-access regressions.

Production web security guidance includes CSP, HSTS, nosniff, referrer policy, permissions policy and runtime-config no-cache rules.

## CI coverage

Current CI covers:
- migration continuity
- fresh PostgreSQL bootstrap + migrations 001–048
- RLS/security smoke tests
- onboarding/compliance/payment/maps/auth/account-notification security checks
- runtime public-config contract
- domain tests
- inline-module/browser DOM regression checks
- centralized runtime-config usage check
- payment worker HTTP contract tests
- secure Portal API contract tests
- frontend/server syntax checks
- payment, notification and portal readiness contracts
- preview smoke
- production application smoke

The last verified green run before this audit refresh was LOADIN CI #337 at commit `b9004d66`. Newer commits must be judged only by their own workflow result.

## Deployment containers

Dockerfiles exist for:
- Portal API
- Payment Worker
- Notification Worker

A Google Cloud/Cloud Run blueprint is documented at `deploy/cloud-run/README.md`.

## Remaining production blockers

The remaining blockers are external environment activation and real-device validation rather than missing core architecture:

1. Dedicated LOADIN Supabase project and application of migrations 001–048.
2. Production phone OTP/SMS provider configuration.
3. Razorpay live account credentials + webhook secret/endpoint registration.
4. Restricted production Google Maps browser key/APIs.
5. Firebase production Web config, VAPID key and server service-account credentials.
6. Deployment of Portal API, Payment Worker and scheduled Notification Worker.
7. Production domains, TLS/security headers and generated `/loadin-config.json`.
8. Seed/assign first Super Admin, city staff and production service controls.
9. Real Customer/Partner/Admin/Fleet end-to-end QA on physical devices/browsers.
10. Final reconciliation of payment, settlement, notification and payout scenarios before go-live.

## Repository safety

`docs/CARGOX_MASTER_BUILD_PROMPT.md` remains inherited legacy CargoX content and is **not** the LOADIN source of truth. `main` must remain untouched unless explicitly approved. LOADIN development remains isolated on `loadin-build`.
