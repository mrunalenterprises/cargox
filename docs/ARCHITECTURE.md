# CargoX Phase 1 Architecture

## Purpose and boundaries
Clean-slate passenger platform. `docs/CARGOX_MASTER_BUILD_PROMPT.md` is full approved implementation instruction; docs/DECISIONS.md is the decision register.
- `packages/cargox_domain/src/index.mjs`: dependency-free server-side demo logic, strict service gating, Pink Rider offers, recurring leg generation, quote snapshots, OTP state machine.
- `apps/demo/server.mjs`: loopback-only in-memory Node HTTP API. `apps/demo/public`: working glossy customer/partner/admin previews; this is **not the production app**.
- `apps/customer`: Flutter customer shell (requires Android/iOS SDK scaffold on developer laptop).
- `apps/partner`: Flutter partner shell (requires SDK and integrated verified auth later).
- `apps/admin`: Next.js admin groundwork. Real role-based auth and production API integrations remain pending.
- `supabase/migrations`: initial design-only SQL with default-deny RLS. DO NOT push to production without review, integration tests and controlled migration.

## State ownership
In production: auth middleware verifies customer/partner/staff; service backend verifies city legal readiness, KYC, per-ride eligibility and matching inside transactions. The current Node demo has **no real authentication** and does NOT claim safe concurrency across server processes. Local mock offers are not real booking assignments.

Ride states: REQUESTED -> ASSIGNED -> IN_PROGRESS -> COMPLETED; generic demo intentionally omits live payment, driver arrival, dispute and cancellation. Future backend requires QUOTED -> REQUESTED/SCHEDULED -> MATCHING -> ASSIGNED -> ARRIVED -> OTP_VERIFIED -> IN_PROGRESS -> COMPLETED and explicit incident/cancel/expired/refund transitions, with audited server authority.

Recurring: immutable route/quoted per-leg amount + weekday/date rule -> list of distinct outbound and return legs, one trip code and eligibility check per leg. Demo provides `previewPack` and unpaid `createDemoPack`, NOT actual automatic recurring fulfillment or paid subscription. Avoid promising committed same driver.

## Explicit threat boundaries
The demo's `/api/demo/customer-code` returns an OTP to a loopback demo browser with no user auth — NEVER expose it on a public address or copy it to production. Demo partners have fictional verification flags and must not be interpreted as verified people. Production needs cryptographic OTP with strict authenticated customer delivery, short TTL and rate limit, replay prevention, audit, identity/selfie integration, live GPS permission and secured expiring tracking shares.

All production child data/school transport, Pink Rider sex/eligibility verification and outstation commercial permits are launch-gated.
