# Secure staging foundation — not a live service

The new `apps/staging-api` is separate from the loopback demo, its fictional identities and its in-memory RideEngine. Flutter and Next still use the local demo; they have not been switched to staging. No remote project has been provisioned, no remote migration applied, and no real SMS/payment is sent by tests.

## What runs now

```powershell
cd C:\Projects\CargoX\apps\staging-api
npm ci
npm run check
npm test
```

The tests apply **both actual versioned SQL migrations**, unchanged, to disposable PGlite PostgreSQL databases with the bundled pgcrypto extension. The installed engine reports PostgreSQL 18.3 / PGlite 0.5.8 / wasm32; the eventual hosted database version must be checked independently. The test-only `auth.users`, `auth.uid()` and `auth.jwt()` fixtures represent the Supabase database contract. Every application query uses `SET LOCAL ROLE authenticated` and transaction-local verified identity claims. Database-owner queries are used only for fixture provisioning and verifier attestations. There are no reusable keys or credentials in fixtures.

These tests execute real PostgreSQL policy/function/transaction semantics, not SQL text matching. They do **not** verify hosted Supabase Auth, PostgREST, Storage, distributed concurrency, SMS delivery or production RLS configuration. The HTTP integration verifier uses an ephemeral asymmetric signing key only inside the test process. The runtime adapter has no test-key or demo-auth fallback.

## Runtime configuration (after isolated staging is approved)

Copy `.env.example` to ignored `.env.local`, set the approved project's reference, HTTPS URL and **publishable** key, then:

```powershell
node --env-file=.env.local src/main.mjs
```

`CARGOX_ENV=staging` is mandatory; the URL must exactly match `CARGOX_STAGING_PROJECT_REF`. Service-role keys, database-owner credentials and demo API ports are rejected. The server binds only to `127.0.0.1:4180` by default. The reference is an operator allowlist, not proof a project is non-production: the operator must verify isolation before configuring it. There is deliberately no automatic remote migration command or deployment in this repository.

Enable phone authentication and the selected SMS/captcha provider in the approved project before testing real OTP. Configure MFA for staff accounts. The adapter validates each bearer token with Supabase Auth `getUser(token)` and forwards that same user JWT to PostgREST. It never decodes unverified claims for authorization and never uses a service-role client. Staff authority is looked up in protected database tables on every action, not user-editable metadata. Sessions are returned only after provider verification; no shared client persists sessions.

## HTTP contract

All responses use `Cache-Control: no-store`. POST requires JSON, has a 16 KB limit and rejects unknown fields. No browser origin/CORS is enabled yet. Native clients use explicit Bearer tokens. Providers time out after seven seconds; errors do not reveal tokens, phone numbers, SQL or provider details.

| Route | Body or result |
| --- | --- |
| GET `/health` | Staging foundation; `demo:false`, `readyForProduction:false` |
| POST `/v1/auth/otp` | `phone` in E.164, `captchaToken`; 202 only if the provider accepted the request |
| POST `/v1/auth/verify` | `phone`, SMS `token`; returns only provider session token fields |
| GET `/v1/me` | Own profile, filtered by RLS |
| POST `/v1/onboarding/customer` | `displayName`, `locale` en/hi/mr, `consentVersion:"2026-09-foundation"`, `consentAccepted:true` |
| GET `/v1/onboarding/customer` | Own onboarding consent record |
| POST `/v1/onboarding/applications` | `cityId`, `accountKind` driver/owner/fleet/agency; save own draft |
| GET `/v1/onboarding/applications` | Applicant/assigned FO/GM-team/Admin scoped rows; first 100 |
| POST `/v1/onboarding/documents` | `applicationId`, `kind` identity/police/permit/insurance, `objectPath` own UUID namespace |
| GET `/v1/onboarding/documents` | Own/assigned FO/Admin references; GM and Accounts cannot read them |
| POST `/v1/onboarding/submit` | `applicationId`; four references required |
| POST `/v1/staff/assignments` | `applicationId`, `fieldOfficerId`; MFA Admin only |
| POST `/v1/staff/reviews` | `applicationId`, `decision` staff_review/approve/reject |
| GET `/v1/staff/audit` | MFA Admin only; first 100, append-only records |

Missing/invalid sessions return 401, denied mutations 403, invalid fields 400, state conflicts 409 and dependency errors 503. Unauthorized SELECTs return an empty RLS result, not another user's data. OTP request limits are five per ten minutes; verification limits ten per ten minutes; other requests 120 per minute per direct socket IP. These are process-local defense-in-depth limits, not a distributed anti-abuse service. Do not expose the server behind a proxy until shared limits, trusted-proxy policy, TLS and observability are implemented. Provider-side per-phone limits and captcha remain required because Supabase Auth is directly reachable.

## Migrations and permission model

`20260928000100_cargox_phase1_schema.sql` remains unchanged. The additive `20260929000100_staging_identity_onboarding.sql` closes client table-write grants and the old initial-profile INSERT policy, then supplies narrow RPCs. The new migration is transactional. A failed migration must be investigated on a disposable staging copy; never edit applied migrations or reset real data.

- Verified, non-anonymous, non-banned phone identities can create a customer profile and consent record. Consent version here is a development contract, not a legally approved final policy.
- Partner applications are separate from operational partner accounts. A draft can collect reference claims; submission locks its content and revision. References **do not prove upload or document verification**. Private Storage policies and signed uploads are not implemented.
- A future trusted verifier must populate `private.partner_verifications` with evidence, matching application revision and expiry. There is no applicant/staff endpoint to set these flags. Do not manually attest real identities just to unblock a demo.
- Active MFA Field Officers can review only their assigned applications. Admin approval requires a different active MFA Admin, a preceding review by a still-active FO, and unexpired checks for the current revision. Reassignment invalidates Staff review. No approval creates an online partner or enables a service.
- GM access is limited to assigned FO teams and excludes document references. Accounts cannot read onboarding, documents or audit. Payout/ledger access is still denied to everyone through the client API.
- Staff memberships and FO teams have no client write policy. Bootstrap actual staff membership only through an approved, audited operator procedure after independently verifying identity; no self-service role grant RPC exists. Staff need an existing verified profile before audited actions. Create a separate inactive staging city for onboarding; no city or staff fixture is seeded by the migrations. That operational bootstrap/role-change workflow is still pending.
- Audit event update/delete is rejected by a trigger, and clients cannot insert, update, delete or truncate it. Database owners remain trusted infrastructure administrators; this is not an externally tamper-evident archive.

## Required next integrations and tests

1. Confirm an isolated Supabase project, migrations review, SMS/captcha provider, staff MFA and audited operator bootstrap. Apply the two migrations there and repeat the negative tests through actual PostgREST JWT sessions before claiming hosted integration success.
2. Add approved consent/privacy copy, private Storage upload/download policies, file validation/scanning/retention and a real verifier attestation service. Document metadata alone must never authorize online status.
3. Implement token refresh/sign-out and customer/partner staging UI repositories behind an explicit environment switch; keep the demo separate. Add pagination before operational data volumes.
4. Build transactional ride acceptance/scheduling, approved maps/rates and safe online eligibility. Payments, child rides, Bike/Shared legal gates, SOS and location sharing remain disconnected.
5. Verify on native PostgreSQL/Supabase with multiple concurrent sessions, real provider failure/rotation/revocation cases, load and security review. PGlite tests do not replace those checks.

## Primary implementation references

- [Supabase phone OTP](https://supabase.com/docs/guides/auth/phone-login)
- [Supabase authentication and JWTs](https://supabase.com/docs/guides/auth/jwts)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [PGlite transaction API](https://pglite.dev/docs/api) and [pgcrypto extension](https://pglite.dev/extensions/)
