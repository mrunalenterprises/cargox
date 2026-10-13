# LOADIN Integration Audit

Date: 2026-10-13
Branch: `loadin-build`

## Current repository health

LOADIN is beyond scaffold stage. The branch contains working Customer, Partner, Admin and Fleet web surfaces, domain logic, a complete fresh-database migration chain, secure production RPCs, deployable Portal/Payment workers, scheduled Notification/Reconciliation workers, live tracking adapters, authentication, production readiness controls, an auditable launch/release gate and deployment contracts.

Latest schema chain: **001 through 054**, contiguous by filename order.

The original missing-foundation finding is resolved. Fresh PostgreSQL CI applies the complete migration chain in order and then executes security/runtime smoke tests.

## Production application surfaces

- Customer: booking, Fare Lock, trip status, cancellation, support/SOS, tracking, payment mode, online payment orchestration, recurring routes, business account, rewards/favourite, reliability/cargo proof, Full Shifting, notifications and account/security.
- Partner: onboarding, private documents, expiry/compliance, fresh identity selfie gate, online/offline, dispatch offers, trip lifecycle, proof, GPS sharing, earnings, wallet/payout, plan comparison, Return Load/replacement, notifications and quality/demand.
- Admin: dashboard, live ops/map, booking detail, partner review, document renewal, finance/payout, finance reconciliation, safety/fraud, growth, support SLA, city/service + pricing controls, live staff/audit management, production readiness and Launch Control/release sign-off.
- Fleet: secure snapshot, vehicle/driver creation, driver↔vehicle assignment/end assignment, vehicle/driver status control, compliance, reports, planner and dispatch board.

## Secure backend layers

### Supabase RPC/database
Browser-facing privileged flows use authenticated, scoped database RPCs. Admin roles/city scope and Fleet ownership are enforced in database functions. Anonymous execution for privileged functions is revoked.

Staff management supports:
- `SUPER_ADMIN`, `GM`, `ACCOUNTS`, `FIELD_OFFICER`,
- Super Admin all-scope management,
- GM limited to Field Officers in the GM's assigned city,
- server-side self-disable/role-change protection,
- audit logging for access changes,
- a service-role-only first Super Admin bootstrap RPC.

### Production bootstrap
`scripts/bootstrap-production.mjs` provides an idempotent trusted deployment bootstrap. After the first Super Admin Auth user exists it can:
- assign/repair the first Super Admin,
- enable the launch city,
- create all four fixed service controls,
- default services to `COMING_SOON` to prevent accidental live bookings.

It supports `--check` and `--dry-run` before mutation.

### Launch Control / release gate
Migration `054_launch_control_release_gate.sql` adds a final go-live authorization layer.

The dynamic gate blocks release approval unless the current launch city has:
- active Super Admin, city GM and Accounts coverage,
- enabled city + all four fixed service controls,
- at least one deliberately ACTIVE service,
- Fare Lock pricing for every ACTIVE service,
- approved partner supply and eligible vehicle supply where needed,
- finance reconciliation completed in the last 24 hours,
- zero open P0/P1 finance reconciliation issues,
- zero unresolved CRITICAL SOS incidents,
- zero unresolved URGENT/safety support cases.

It also stores required manual evidence for real OTP, Razorpay signed webhook, restricted Maps key, FCM, security headers and Customer/Partner/Admin/Fleet physical-device E2E. Super Admin can record PASS/FAIL/PENDING or a reasoned WAIVER.

Release candidates store the intended Git commit plus the gate snapshot. Approval rechecks the live gate and refuses approval when conditions have deteriorated. Approval is an auditable authorization record only; it does not automatically deploy code or enable services.

`scripts/launch-preflight.mjs` provides a production CLI gate that verifies core deployed pages, Portal API readiness, the live launch gate, an APPROVED release sign-off and optional deployed-commit matching.

### Portal API
`services/portal-api/worker.mjs` provides a deployable HTTPS API for Admin/Fleet reads and mutations. Current application routes cover:
- dashboard and Fleet snapshot,
- support resolution,
- city/service snapshot + status,
- city pricing,
- Admin staff snapshot + access mutation,
- finance reconciliation snapshot/run/resolution,
- Launch Control snapshot/manual checks/release create/approve/revoke,
- Fleet vehicle/driver/assignment/status mutations.

The service forwards the signed-in user's JWT to Supabase and uses only the public anon key. It adds exact browser-origin allow-listing, request-body limits, JSON validation, readiness/liveness endpoints and contract tests. It does **not** require a service-role key.

### Payment worker
`services/payment-worker/worker.mjs` implements provider-neutral online-payment orchestration with Razorpay support, server-side order creation, signed webhook verification, idempotent event handling, amount validation, strict browser CORS and request-body protections.

### Notification worker
`services/notification-worker/worker.mjs` claims queued notifications, sends FCM messages using service-account OAuth, records delivery outcomes and refreshes document compliance.

### Finance reconciliation worker
`services/reconciliation-worker/worker.mjs` is a trusted scheduled job that validates completed bookings against payments, settlements and balance events. It detects missing settlements, insufficient confirmed online payments, Fare Lock/settlement mismatch, 15%/0% commission rule violations, entitlement mismatch and missing balance ledger events. P0 findings can raise an operations alert via exit code `3`.

Admin also has an on-demand Finance Reconciliation Center with audited Resolve/Ignore actions.

## Browser runtime security

Runtime configuration is centralized and generated from public-only `LOADIN_PUBLIC_*` values. CI rejects secret-like values in generated browser config and prevents direct config-access regressions.

Production web security guidance includes CSP, HSTS, nosniff, referrer policy, permissions policy and runtime-config no-cache rules.

## CI coverage

Main LOADIN CI covers:
- migration continuity,
- fresh PostgreSQL bootstrap + migrations **001–054**,
- RLS/security smoke tests,
- onboarding/compliance/payment/maps/auth/account-notification security checks,
- staff scope + Super Admin bootstrap + finance reconciliation security/runtime smoke,
- launch-gate permissions, dynamic READY state and release approve/revoke smoke,
- runtime public-config contract,
- domain tests,
- inline-module/browser DOM regression checks,
- centralized runtime-config usage check,
- payment worker HTTP contract tests,
- secure Portal API contracts including staff/reconciliation/launch/Fleet/Admin pricing,
- frontend/server syntax checks,
- Payment, Notification, Portal and Reconciliation worker readiness contracts,
- production bootstrap + launch-preflight configuration validation,
- preview + production application smoke.

A dedicated `LOADIN Ops CI` separately replays the full migration chain and validates staff/reconciliation/launch security, Portal API contracts, bootstrap readiness, reconciliation worker readiness, launch-preflight configuration and Admin operational previews.

The last verified green state before the 054 launch-gate batch was commit `86205adb`:
- **LOADIN CI #399** — SUCCESS.
- **LOADIN Ops CI #7** — SUCCESS.

The 054 batch must be judged only by its own final workflow results; no production-ready claim should be made from an older green run.

## Deployment containers

Dockerfiles exist for:
- Portal API,
- Payment Worker,
- Notification Worker,
- Finance Reconciliation Worker.

A Google Cloud/Cloud Run blueprint is documented at `deploy/cloud-run/README.md`, including one-time bootstrap and scheduled reconciliation guidance.

## Remaining production blockers

The remaining blockers are external environment activation and real-device validation rather than missing core architecture:

1. Dedicated LOADIN Supabase project and application of migrations 001–054.
2. Production phone OTP/SMS provider configuration and first Super Admin production Auth user.
3. Trusted one-time production bootstrap, then real GM/Accounts/Field Officer assignment.
4. Razorpay live account credentials + signed webhook endpoint registration.
5. Restricted production Google Maps browser key/APIs.
6. Firebase production Web config, VAPID key and server service-account credentials.
7. Deployment of Portal API, Payment Worker, Notification Worker and Reconciliation Worker.
8. Production domains, TLS/security headers and generated `/loadin-config.json`.
9. Real Customer/Partner/Admin/Fleet end-to-end QA on physical devices/browsers and evidence capture in Launch Control.
10. Final real-money payment/settlement/payout reconciliation with zero open P0/P1 finance issues.
11. Super Admin APPROVED release sign-off for the intended deployed commit.
12. Final `npm run preflight:launch` pass against the production environment.

## Repository safety

`docs/CARGOX_MASTER_BUILD_PROMPT.md` remains inherited legacy CargoX content and is **not** the LOADIN source of truth. `main` must remain untouched unless explicitly approved. LOADIN development remains isolated on `loadin-build`.
