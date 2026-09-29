# CargoX — Phase 1 product contract (clean restart)
Date: 28 September 2026. Status: implementation baseline; prices, launch city and some regulated-service policies remain configurable and pending verification.

## Clean start
Do not import any former CargoX repo, Flutter source, Firebase project, Supabase schema, secrets or migrations. This GitHub branch is the new reference for planning. New code, migrations, test data and CI from scratch. Do not force-push main.

## Phase 1 service catalogue
- Bike taxi
- Auto rickshaw
- City car (vehicle classes configurable)
- Outstation car (one-way, round-trip and **Outstation Daily Car**)
- Shared car (seat inventory, per-seat fare, scheduled routes)

**Defer goods transport/logistics and parcel services to Phase 2.** Preserve clean extensibility only. All actual services must be disabled until city-specific legal/permit and operational readiness are confirmed.

## All applicable passenger booking modes
1. Book Now, where service is eligible.
2. Schedule Once (date/time, single leg or eligible return).
3. Daily / Recurring Rides (weekdays, fixed stops, pickup time, optional return time, start/end dates).
4. Monthly Ride Pack for the same fixed pickup and drop (one-way or two-way) including office, school, college, classes, general commuting and outstation daily car where allowed.

Customer Home should show five services, a prominent Daily Services section (Office, School, College, Classes, Other), and My Monthly Packs. Outstation should offer One Way | Round Trip | Daily Car. Daily Services can create a scheduled once-off, recurring, or monthly plan. A plan must define operating days, route, times, ride/leg count, exclusions, full upfront price, cancellation/skip/no-show/refund policies and availability; do not imply a fixed driver guarantee.

**Each return leg is a separate ride occurrence** with its own assignment, start OTP, lifecycle and safety tracking. The server is authoritative for schedule generation, eligibility, pricing, capacity, commission and accounting. Plans cannot oversell unavailable capacity; disclose pending assignment when that is the case.

## Pink Rider — core matching logic
Opt-in verified woman drivers choose Women Only or Women + Men when lawful; eligible women riders select Pink Rider Only or Any Eligible Rider. Never silently substitute a non-Pink driver for Pink Rider Only, including replacement for scheduled/monthly trips. Shared Car Women Only validates the complete passenger party, not merely the account holder; design consent and minimal evidence retention. Applicable services only, per-city gates.

## Trip safety
Partner KYC/police verification, permitted vehicle and current insurance checks, Staff verification and Admin final approval; fresh selfie on every Go Online compared to verified registration photo with uncertainty/manual review flow; unique rate-limited four-digit trip start code verified server-side; separate SOS for passenger and partner, approved-support incident workflows, consent-based live location and expiring signed trip-share URLs. Recording/route-risk alerts are optional later additions requiring consent/legal review; never present unstaffed help as live 24/7 service.

**Child/guardian recurring rides need an independent launch gate**: verified parent/guardian consent, eligible licensed/insured vehicle and vetted driver, authorised pickup/handover contacts, child-safe tracking privacy, absent child/missed handover exception workflows, local school transport and child safeguarding compliance. Do not enable unaccompanied child trips in the initial MVP until operational safeguards are fully implemented and approved.

## City, fares, partner and Admin
- City is primary operational unit; per-city ON / Coming Soon plus legal and partner-capacity readiness flag by service and route.
- Driver/owner/fleet/agency types. Customer OTP self-approval. Staff verification + Admin final approval for partner.
- Transparent Standard vs Self Rate where specifically lawful/enabled; configurable default 25% commission is a *proposal*, subject to final business and regulatory sign-off. If enabled, weekly self-rate change windows enforced server-side.
- Transparent quote, taxes, tolls, parking, waiting, cancellation and refund; driver payout and platform ledger separately recorded and auditable.
- Admin RBAC: Admin, GM, Accounts, Field Officer; payouts require final authorised approval; no over-privileged client writes.
- Booking lifecycle and double-booking prevention are server-authoritative and transactional. Shared seats locked atomically with expiry to prevent overbooking.

## Apps and suggested baseline
- `apps/customer`: Flutter.
- `apps/partner`: Flutter.
- `apps/admin`: Next.js TypeScript.
- `packages/domain`: pure domain (Dart or language appropriate to clients), with published cross-platform JSON/HTTP API contracts.
- `supabase/`: new Postgres migrations + Row Level Security + Edge Functions if chosen; do not create/use production credentials by default.
- `docs/`: architecture decisions, API contracts, threat model, screen list, test plans.
Technology finalisation should happen during foundation review; map/location provider and payment settlement selected after cost and regulatory review. The server is source of truth, not Flutter.

## First implementation sequence
0. Git/local backup check, new monorepo scaffold, reproducible setup and CI, environment examples, domain and API contracts.
1. Minimal app navigation, OTP-auth design with non-production mocks, city service availability, fixed pickup/drop selection, booking/recurrence/plan models, and unit tests.
2. End-to-end Auto + Car one-off and scheduled pilot in one city, verified driver dispatch, location, trip OTP, SOS and auditable checkout/settlement.
3. Office Daily/Monthly Ride Packs end-to-end (separate return-leg occurrence), partner shift commitments, cancellations and calendar, pricing snapshots.
4. Pink Rider robust end-to-end matching, safety/privacy tests.
5. Outstation Daily Car, then legally approved Bike and Shared Car. School/college/tuition require safeguarding clearance.
6. Performance, negative-case, payment and privacy tests, safety drills, controlled pilot rollout.

## Non-negotiable foundation tests
- Pink Rider Only never auto-falls-back; women-only shared-car full-party eligibility.
- No driver overlapping ride commitments or double accept.
- Monthly plan generates correct weekdays and separate return legs; no unsold/expired plans dispatch.
- Immutable purchased plan quote, idempotent charge/refund, transparent cancellation policy.
- Ineligible vehicle/expired permits/city OFF block dispatch.
- Guardian-only access to child journey and authorised handover state.
- Each ride's start OTP unique, single-use, short-lived and rate-limited.
- No credentials, personal data, or production endpoints committed to Git.

## Definition of done for foundation sprint
Clean repository structure, compileable placeholder customer and partner apps, functioning admin scaffold, mocked local environment, documented architecture and schema drafts, tests runnable on developer Windows machine, CI lint/test configuration, and a progress report with exact commands and outstanding blockers. This is **not** a claim that the platform is launched.
