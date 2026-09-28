# CargoX Phase 1 Architecture

## Purpose and boundaries
Clean-slate passenger platform. `docs/CARGOX_MASTER_BUILD_PROMPT.md` is full approved implementation instruction; docs/DECISIONS.md is the decision register.
- `packages/cargox_domain/src/index.mjs`: dependency-free server-side demo logic, strict service gating, Pink Rider offers, recurring leg generation, quote snapshots, OTP state machine.
- `apps/demo/server.mjs`: loopback-only in-memory Node HTTP API. `apps/demo/public`: working glossy customer/partner/admin previews; this is **not the production app**.
- `apps/customer`: Flutter Customer service journeys and verified Android scaffold; local API only.
- `apps/partner`: Flutter Partner offer/OTP journeys and verified Android scaffold; local API only.
- `apps/admin`: Next.js admin groundwork. Real role-based auth and production API integrations remain pending.
- `apps/staging-api`: separate Supabase Auth/user-JWT adapter and constrained onboarding endpoints. No privileged backend key or demo-auth fallback.
- `supabase/migrations`: initial domain SQL plus additive identity/onboarding policies, tested locally in PGlite PostgreSQL. Neither migration has been applied to hosted Supabase. DO NOT push to production without review, hosted integration tests and controlled migration.

## State ownership
In production: auth middleware verifies customer/partner/staff; service backend verifies city legal readiness, KYC, per-ride eligibility and matching inside transactions. The current Node demo has **no real authentication** and does NOT claim safe concurrency across server processes. Local mock offers are not real booking assignments.

Ride states: REQUESTED -> ASSIGNED -> IN_PROGRESS -> COMPLETED; generic demo intentionally omits live payment, driver arrival, dispute and cancellation. Future backend requires QUOTED -> REQUESTED/SCHEDULED -> MATCHING -> ASSIGNED -> ARRIVED -> OTP_VERIFIED -> IN_PROGRESS -> COMPLETED and explicit incident/cancel/expired/refund transitions, with audited server authority.

Recurring: immutable route/quoted per-leg amount + weekday/date rule -> list of distinct outbound and return legs, one trip code and eligibility check per leg. Demo provides `previewPack` and unpaid `createDemoPack`, NOT actual automatic recurring fulfillment or paid subscription. Avoid promising committed same driver.

## Explicit threat boundaries
The demo's `/api/demo/customer-code` returns an OTP to a loopback demo browser with no user auth — NEVER expose it on a public address or copy it to production. Demo partners have fictional verification flags and must not be interpreted as verified people. Production needs cryptographic OTP with strict authenticated customer delivery, short TTL and rate limit, replay prevention, audit, identity/selfie integration, live GPS permission and secured expiring tracking shares.

All production child data/school transport, Pink Rider sex/eligibility verification and outstation commercial permits are launch-gated.

## Local Flutter integration (2026-09-28)

`packages/cargox_demo` is an injectable Dart adapter, restricted to loopback/emulator HTTP origins, with bounded requests and explicit errors. No identity, pricing or payment authority is moved into the UI. Flutter quote requests use POST /api/quotes; unpaid draft library uses GET /api/plans. Existing ride/offer/code/start/finish endpoints remain the authority. No additional external service or database was connected.

Android defaults to 127.0.0.1 with adb reverse. Debug-only cleartext enables the local API. The Apps do not request location or document permissions. User-supplied eligibility switches represent fictional fixtures only. Existing untracked legacy-looking artifacts were preserved and not imported.

## Staging identity foundation (2026-09-28)

`Supabase Auth getUser(token)` verifies an identity before the staging API forwards the same user JWT to PostgREST. Database RLS and narrow SECURITY DEFINER RPCs constrain every read and mutation. The functions pin their search path and revoke default public execution. Protected staff memberships, mandatory staff MFA and FO/GM team assignments determine scope independently of editable metadata. There is no service-role bypass in the runtime adapter.

Customer consent and partner application/document-reference collection are implemented. Applications have locked submitted revisions, then assigned Staff review and independent Admin approval. A separate private verifier table must attest current evidence before review succeeds. No approved application automatically becomes an online driver. Audit writes are internal; client insert/update/delete/truncate are denied. See STAGING_FOUNDATION.md for the tested contract and outstanding Storage/provider/operational dependencies.

The test harness installs the real migrations into disposable PGlite databases and supplies a minimal test-only Supabase auth schema. HTTP tests sign ephemeral JWT fixtures; runtime code has no fixture signer. This proves local policy and endpoint behavior, not hosted Auth/PostgREST integration or distributed dispatch concurrency. Flutter and Next remain attached to the isolated demo.
