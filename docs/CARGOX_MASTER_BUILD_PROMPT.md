# PIP PIP — ONE-PROMPT MASTER BUILD CONTRACT

> **Brand update:** This historical technical filename remains stable. Product-facing references in this repository use **PIP PIP**, by **Mrunal Technologies**; legacy `CargoX` references below are historical contract or technical identifier text. See `docs/BRANDING.md`.
Date: 2026-09-28
Owner: Mrunal Technologies
Purpose: paste the short bootstrap instruction below into VS Code Codex **once**; this file is the full execution specification.
Status: Development instructions, not a claim that the requested app has been implemented.

## BOOTSTRAP INSTRUCTION FOR CODEX
Read `docs/CARGOX_MASTER_BUILD_PROMPT.md` completely and treat it as the single source of truth for this clean-start CargoX project. You have permission to write and test project code within this repository, but **do not delete uncommitted user work, rewrite Git history, run production migrations, provision paid services, deploy publicly, or create live payment transactions without explicit approval**. Execute the work end-to-end in logical batches instead of stopping after planning. Make sensible documented choices when unspecified. After every batch, run available checks, commit only your own verified work to a feature branch, and update `docs/BUILD_PROGRESS.md` so another session can resume without rework. If runtime/tool/context constraints stop you, report the exact completed state, failed command, and single next action. Ask questions only for genuine blockers such as required credentials, legal approvals or ambiguous destructive operations. Start now by checking local Git, tooling and the existing files; then scaffold and build.

## A. PROJECT GROUND RULES
- CargoX is a **new** application, not a migration. Do not reuse or import legacy CargoX source, database, authentication project, maps keys or build artifacts.
- Inspect existing repository/local status before editing. If project files already exist, identify and preserve them rather than overwrite. Create a safe feature branch named `feature/passenger-phase1-v1` unless it already exists; if so, continue it safely. Never use `git reset --hard`, `git clean -fd` or force push.
- This is a Phase 1 **passenger** app. Phase 2 goods transport, trucks, parcels and courier are outside scope and must not inflate this build.
- Deliver real runnable code, not only architecture prose or mock screens. If external services are unavailable, implement runnable local/mock adapters **explicitly marked demo** so the vertical slice can run, alongside migrations/contracts for production connectivity. Never simulate a successful production integration.
- Prefer a maintainable monorepo: Flutter Customer app, Flutter Driver/Partner app, Next.js Admin web, shared Dart domain/design package, backend services and Supabase SQL migrations (adapt only if an unavoidable incompatibility emerges). Use installed stable compatible versions and pin versions/lockfiles; never hardcode secret keys. Include Windows PowerShell commands in README.
- Server is authoritative for identity/eligibility, location access, pricing, recurring obligations, quotas, matching, booking status, trip-start OTP, seat locking, payouts and permissions. Never place secrets in Flutter/web apps. Row-level policies and explicit role checks are mandatory; use migrations not manual DB edits.
- Prefer a local end-to-end pilot before broad features; preserve all required schema/models early to avoid rebuilds. Separate domain, repository/services, state/UI and infra. Every feature has tests and clear definition of done.

## B. CUSTOMER-FACING SERVICES AND BOOKING MODES
Home services:
1. Bike Taxi (only in city/vehicle/legal eligibility regions; otherwise Coming Soon).
2. Auto Rickshaw.
3. Car (Admin-configurable Mini, Sedan, SUV).
4. Outstation Car: One Way, Round Trip **and Daily Intercity Car**.
5. Shared Car: per-seat availability, route/stop rules and explicit passengers; do not launch until regulated model is confirmed.
Never silently conflate private carpooling with licensed commercial pooling.

Across eligible local services: **Book Now**, **Schedule Ride**, **Daily/Recurring Ride** and **Monthly Ride Pack**. Outstation Daily Car supports fixed two-city commute with optional return. Dedicated Home card **Daily Services** and shortcut **My Monthly Packs**, not hidden under Outstation.
- Daily Services presets: Office pickup/drop; School; College; Tuition/Classes; Other fixed route; Outstation Daily Car.
- Daily form: selected service, purpose, route/map stops, date range, weekdays, pickup time, optional return journey with independent time, plan size, optional preferred driver, passenger count and transparent total quote.
- Monthly Pack: **same fixed pickup and drop** for selected days, One Way or Pickup + Return, committed number of journeys, optional preferred qualified partner **without guaranteed assignment**, holidays/pauses/no-show/late change/refund policy disclosed before payment, plan calendar, entitlements and renewal via explicit consent.
- Every generated journey leg has its own assignment, trip-start OTP, state, cost allocation, receipt and failure/refund handling. Do not create an overlap for the same driver/vehicle; changes to fixed route require re-quote and permission. No silent auto-renewal.
- Outstation intercity quotes expose included kilometres, waiting, tolls, parking, taxes, driver allowances, empty-return rules, one-way/return options and daily pack totals.

## C. PINK RIDER — NON-NEGOTIABLE MATCHING
Pink Rider is an eligibility+preference layer across permitted service types, not another class of vehicle.
- A **verified eligible female partner** opts in and selects **Women Only** or **Women + Men** where lawful.
- Eligible women customers choose **Pink Rider Only** or **Any Eligible Partner**; for recurring/monthly bookings preserve the preference on every occurrence.
- If Pink Rider Only is selected and no qualified opted-in partner is available, show availability failure and offer a *clearly consented* change or cancellation/refund under the disclosed policy. **Never silently substitute** a non-Pink driver, including mid-plan.
- Women-only Shared Car (where cleared) checks every passenger and full guest party and driver eligibility; protect sensitive verification information.
- Fresh go-online selfie compared with consented verified enrollment photo, with secure anti-replay options, uncertain-match manual review, and no unsupported promise of safety.

Selected creative tagline, stored internally:
**“Pink Rider — World’s 1st Women Safety Rider, crafted in Chhatrapati Sambhajinagar, MH.”**
The **“World’s 1st” claim is unverified**; **do not publish it** in app store copy, public site or ads without documented factual substantiation and legal review. Use public-safe interim wording “Pink Rider — Safer rides for women, crafted in Chhatrapati Sambhajinagar, MH.”

## D. SAFETY, VERIFICATION AND CITY CONTROLS
- Customer login via OTP. Partner roles: Individual Driver/Rider, Vehicle Owner, Fleet Owner, Company/Agency. Minimal onboarding first; verified documents, applicable police verification, permits, vehicle/insurance, Staff review then Admin final approval before online.
- City is operating unit. Each city has legal and operational readiness gates and per-service ON vs Coming Soon; independent route/daily pack capability switches. Check eligibility again on offer acceptance and ride start.
- Unique short-lived, server-verified, rate-limited 4-digit trip-start code per booking leg. `IN_PROGRESS` only after successful OTP validation.
- Live driver location and ETA with consent-based secured time-limited share link; driver/customer SOS, staffed escalation workflow, incident report and audit. Implement privacy retention and strict permissions. Do not claim app technology itself ensures safety.
- Guardian-managed school/class bookings: minimum child data, verified/consenting guardian, authorized pickup/drop adults, driver/vehicle extra eligibility and location-based pickup/drop notice. Implement exception state if child or adult is absent. Disable real child transport until local legal, licensing and operational policies are reviewed and approved. Treat child data and route privacy as especially restricted.
- Separate Admin roles: Super Admin, GM, Accounts, Field Officer. GM may see only assigned FO/team scope; payout changes need Admin approval; immutable audit log for approvals, pricing, cancellations, access-sensitive events, refunds and settlement.
- Support Marathi, Hindi and English (structure translations with fallbacks; prefer original accessible icons and legible labels).

## E. PRICING, PAYMENTS AND OPERATIONAL FINANCE
- Standard Rate / Self Rate only in city/service jurisdictions cleared by Admin/legal; partner self-rate may be uncapped *only if lawful*, optional Monday-only once-weekly change rule enforced by server with test coverage. The customer must see full applicable fare and knowingly choose.
- Starting default platform commission **25% as an Admin-configurable placeholder**, not a confirmed market-wide legal or final commercial rate. Keep independent per-service/city configurations.
- Fare snapshot attached to confirmed ride/pack; show upfront breakup and cancellation/refund before payment. Separate gross fare, net payout, commission, taxes, adjustments and reimbursements. Idempotent verified payment webhooks and traceable settlement; never mark paid from an unverified client response.
- Accept configurable payment integration adapters; for local demo use labeled fake provider. Never enable live payments before secrets, contracts and reconciliation reviewed.

## F. VISUAL DESIGN — GLOSSY AND FAST, NEVER HEAVY
Deliver **original, premium, glossy, dynamic** UI inspired by modern mobility apps but without copying competitor screens/assets.
Theme tokens:
- `brand.primary: #59BAA1` (Mint Teal);
- `brand.mintSurface: #B4DACF`;
- `brand.accent: #5AC0A5`;
- `brand.deepAction: #0E885A`;
- `surface.card: #ECEDED`;
- `surface.primary: #FFFFFF`;
- Pink Rider uses a complementary, accessible pink accent specified consistently in tokens.
Cards: layered very subtle white-to-mint gradients, controlled specular highlight, soft shadow and 14–22px radius; crisp illustrated vehicle image/icon + vehicle name + ETA or clear subtitle + transparent price/availability. Do not clutter the Home screen. Distinct card states for selected, unavailable and Coming Soon.
Motion: fast and smooth, measured transitions approx **150–240ms**, spring tap response, subtle card lift/slide/scale and small reflective shimmer **once on reveal** rather than constant distracting looping. Animated layout changes maintain stable hit targets. Use slivers/lazy lists and cached assets; avoid expensive backdrop blur, overdraw, shader jank, huge animated GIFs and unnecessary rebuilds. Respect device reduced-motion setting; keyboard/screen-reader accessibility and large text must remain usable. Target fluid 60fps on supported typical devices and profile on a real budget Android phone; never promise measured fps without measurement.
Screen inventory:
Customer: Splash/language, Login, permissions, City, Home, map/pickup/drop, service class and quote, Pink Rider preference, schedule/daily pack flows, payment, matching/driver card, OTP, tracking, trip sharing/SOS, receipt, help/history, My Monthly Packs/calendar, guardian dashboard.
Partner: login/role, registration+document steps, staff/admin review status, fleet/vehicle/service preferences, Pink Rider opt-in, price settings where enabled, fresh go-online selfie, incoming offer/accept, navigation, OTP start, trips, scheduled workload, earnings and SOS.
Admin: login/RBAC, city/service/route control, onboarding/document approval, dispatch/incident desk, fare settings, Pink Rider permissions, daily/monthly plan oversight, GM-FO reports, payouts/reconciliation, audit logs and feature flags.
Generate shared reusable card components and short motion demos/widget tests. Ensure visual polish actually appears in running app, not only static mockups.

## G. ARCHITECTURE AND DATA CONTRACTS
Proposed structure (adapt if tooling requires):
```
apps/customer/                 Flutter customer
apps/partner/                  Flutter driver
apps/admin/                    Next.js admin
packages/cargox_domain/        Pure Dart models, states, constraints
packages/cargox_ui/            Flutter theme and reusable glossy cards
supabase/migrations/           Versioned SQL + RLS
supabase/functions/            Authorized transactional API functions
docs/                          Scope, decisions, sequence, testing, runbook
.github/workflows/             CI
```
Domain models should include City, ServiceCategory, VehicleClass, Partner/Vehicle eligibility, PinkPreference, Passenger/Guardian, Quote, Ride, RideOccurrence, ScheduleRule, DailyRoute, MonthlyPack, PackEntitlement, SharedSeatAllocation, LocationShareGrant, Incident, AuditEvent, PaymentIntent, LedgerEntry, Payout and Refund.
Document event transitions and API contracts before duplicating logic across apps. Postgres/PostGIS where suitable; use transactions/locks for offer acceptance, seat inventory, plan entitlements and payment idempotency.

## H. EXECUTION — MANY OUTPUTS, ONE INSTRUCTION
Run without stopping after the plan, and do not ask for approval at every micro-step. Work in these logical batches with self-verification:
1. **Repo audit + design system and requirements:** inspect Git status/installed tools; write `docs/DECISIONS.md`, `docs/ARCHITECTURE.md`, `docs/SCREENS.md`, this file as governing reference, and `docs/BUILD_PROGRESS.md`. Label unknown commercial/legal choices configurable or launch-gated rather than invent policy.
2. **Scaffold and data contracts:** Flutter customer/partner, Next.js admin, shared Dart domain/UI, localization, Supabase migrations/RLS, dev env examples, CI and domain/unit test setup. No destructive migration.
3. **Working vertical slice:** in one local/demo city, Auto and Car immediate + scheduled ride flow from Customer quote -> matching -> Partner accept -> server-side OTP -> in progress -> completion -> demo settlement and receipt, with Admin approval/status. Make locally runnable through safe mock adapters if live service credentials are missing.
4. **Daily / Monthly / Outstation:** actual route/recurrence generation, daily calendar, monthly fixed-route pack quoting/entitlements, separate return legs, outstation Daily Car cards, preferred partner reallocation and policy-driven cancellations/refunds. Tests for weekday selection, months and daylight timezone, overlaps, route modifications and double-claim.
5. **Pink + safety:** cross-app preference, never-silent fallback, approved-partner and expiring docs gates, secure tracking share, role isolation, driver/customer SOS and guardian interfaces. Gate unsupported live child service pending external approvals.
6. **Service completion and polish:** add Bike and Shared Car with Coming Soon/permit gates when not authorized; premium glossy responsive cards in all apps; live error/empty/loading states, accessible transitions and performance review; complete Admin settings/reporting.
7. **Regression and handoff:** run formatter/static analysis/unit/integration/widget tests, build runnable apps where local SDKs available, execute a manual golden-flow checklist and fix discovered errors. Provide `README.md` with Windows setup, environment variables, local/mock run commands, admin demo credentials via secure fixtures (no public real passwords), deployment checklist and actual not-yet-integrated items. Keep `docs/BUILD_PROGRESS.md` updated with file paths, completed/tested/pending and next exact command after EACH batch. Commit only work verified by tests.

**Required acceptance tests**: no driver double assignment, no shared-seat overbooking, Pink Rider Only never fallback even for recurring replacements, Women Only shared group checks, server-limited OTP, invalid-expired KYC blocks online, city OFF blocks bookings, daily weekdays/month lengths and distinct return legs, no unauthorized guardian access, no money double-charge/refund, immutable fare snapshots, denied unauthorized GM/accounts/admin reads, reduced-motion glossy cards still usable.
When dependencies/SDK missing, record the missing tool, finish everything that does not require it, and provide one copy-paste install/build command. State accurately what is runnable, simulated, tested, or blocked.

## I. DEFAULT DECISION POLICY
Reasonable technical defaults may be selected autonomously and recorded. Never manufacture legal clearance, live pricing, insurance or permit approvals, emergency-staff availability, third-party API credentials, payment readiness, published app claims or completion evidence. Build legal/safety-sensitive capabilities behind explicit disabled feature flags until verified. Prioritize a complete tested core over many broken screens. Every subsequent Codex session should first read `docs/BUILD_PROGRESS.md` and continue the first incomplete batch without reimplementing completed work.
