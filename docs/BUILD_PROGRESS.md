# CargoX Development Progress

Updated: 2026-09-28
Branch: `feature/passenger-phase1-v1`
Protocol: update this file **after each batch**; distinguish committed code from verified working features. Do not reset or repeat existing progress.

Current local status: batches E1–E3 completed on this feature branch. Customer/Partner Android scaffolds, service navigation, local Auto/Car journeys and the read-only Admin preview are implemented and locally verified. The production pilot is NOT complete; see the remaining-work section at the end. Earlier batch notes are historical evidence, not the current build status.

## Phase 1 scope and non-negotiable constraints

Fresh CargoX build; no old code/database reused. Bike, Auto, Car, Outstation incl Daily Car, Shared Car; Pink Rider preferences; Schedule, Daily and Monthly fixed-route packs. Phase 2 goods logistics deferred. Mint #59BAA1 glossy, smooth, accessible UI. Sensitive service and legal claims remain launch-gated.

## Batch A — repository audit and written contracts

- [x] Verified `main` had master build prompt and minimal README; created separate feature branch and did not modify `main`.
- [x] `docs/DECISIONS.md`, `docs/ARCHITECTURE.md`, `docs/SCREENS.md` added with explicit unresolved policy questions.
- [x] Added scope/limitations and Windows developer instructions to `README.md`.
- [x] Verify installed SDK versions on developer laptop (batch E1; resolved app builds in E2/E3).
- [ ] Confirm first live city, regulator-approved service types, pooling model and operational policies.

## Batch B — runnable demo/domain, UI shells and initial schema

- [x] `packages/cargox_domain/src/index.mjs`: dependency-free in-memory domain prototype with city switches, indicative fare snapshots, verified-demo partner gating, strict Pink Rider-only matching, driver overlap guard, hash-based one-use 4-digit demo OTP, daily/return occurrence generator and unpaid monthly quote.
- [x] `apps/demo/server.mjs`: 127.0.0.1-only API with fictional drivers and demo-only customer-code endpoint.
- [x] `apps/demo/public`: original mint glossy, responsive Customer/Driver/Admin interactive web demo. Reduced-motion CSS support, fast subtle UI effects.
- [x] `tests/domain.test.mjs` and `tests/api.test.mjs` committed. CI workflow `.github/workflows/test.yml` committed.
- [x] `packages/cargox_ui`: Flutter reusable color tokens and interactive glossy card source.
- [x] `apps/customer`: Flutter customer Home, Pink Rider preference, local booking, Daily/Monthly unpaid quote preview source.
- [x] `apps/partner`: Flutter fake partner offers / accept / start OTP / complete source.
- [x] `apps/admin`: Next.js read-only local Admin status preview source.
- [x] `supabase/migrations/20260928000100_cargox_phase1_schema.sql`: default-deny RLS **design migration, not deployed**.
- [x] **Node demo verification:** [GitHub Actions run 36433401322](https://github.com/mrunalenterprises/cargox/actions/runs/36433401322) completed successfully on 2026-09-28: JS source checks succeeded, **19/19 real Node domain and HTTP API tests passed**, 0 failures. This verifies the in-memory demo functions tested there, **not** Flutter/Next builds or production security. Additional Flutter UI widget tests have been committed but not run yet.
- [x] Flutter SDK project platform files, analysis, widget tests and Android debug builds (E1/E2); Android emulator integration journeys (E3).
- [x] Next dependency installation, pinned lockfile, TypeScript and production compilation (E2/E3). This compilation is a local preview build, not deployment.
- [ ] Staging Supabase database migration and RLS integration tests. **Do not deploy migrations to production.**

## Batch C — true pilot (not yet implemented)

- [ ] Real OTP/JWT authentication, verified RBAC, Staff then Admin approvals, partner onboarding (documents/police/permit/insurance).
- [ ] Proper map/geocoding/router pricing, consent-based partner GPS/ETA, secured customer trip sharing and staffed incident/SOS workflow.
- [ ] Production transaction-safe offers/acceptance and driver scheduling; fare policy, verified payment integrations, refunds/ledger and settlement.
- [ ] Real Auto/Car Book Now + Schedule vertical slice tested across Flutter Customer, Partner and Next Admin against a secure staging backend.

## Batch D — subscriptions, outstation and safety (not yet implemented)

- [x] Recurring weekdays + separate return-ride **generator and unpaid quote preview only**.
- [ ] Persistent scheduled jobs and atomic plan entitlements, weekly/holiday skips, pauses, cancellation/refund rules, driver replacements with no silent Pink substitution, dedicated Outstation Daily Car implementation.
- [ ] Production Pink Rider privacy-protecting enrollment and matching, fresh selfie vendor integration and never-fallback regression on recurring replacements.
- [ ] Guardian + authorized pickup handoff safety workflow; launch disabled until verified legal/operational approvals.
- [ ] Bike and Shared Car launch gates / appropriate production flows once approved.

## GitHub review checkpoint

- Draft pull request: https://github.com/mrunalenterprises/cargox/pull/3 (head: `feature/passenger-phase1-v1`; base: `main`). It is **draft**. Do not merge until CI and app builds plus security review succeed.
- Root npm test script is `node --test` to avoid Windows glob expansion issues.

## Original remote CI checkpoint (superseded locally by E2/E3 below)

- GitHub Actions verified `npm run check:demo` and `npm test` passed (19 tests) on [run 36433401322](https://github.com/mrunalenterprises/cargox/actions/runs/36433401322). This is the original remote result. Later local Flutter, Android and Next results are recorded in E2/E3; physical-device performance remains unverified.
- If CI is green later, add run URL and date. If it fails, record the exact error and fix in this branch.
- The local demo is in-memory, unauthenticated and binds to 127.0.0.1; it must not be deployed.

## Historical handoff before E1 (completed; do not repeat)

Run the local visual/interactive walkthrough, Flutter UI tests and Next build; fix any failures. On Windows after fetching and safely switching to the branch:

```powershell
cd C:\Projects\CargoX
git status
git fetch origin
git switch --track origin/feature/passenger-phase1-v1
node --version
npm run check:demo
npm test
npm run dev:demo
```

If branch already exists locally, omit `--track`. Open http://127.0.0.1:4173, try the Customer -> Partner -> OTP -> Admin happy path. Preserve any local modifications before switching. Then install Flutter/Next SDK dependencies and continue unfinished tasks; never implement these same demo files again just to show activity.

## Batch E1 — canonical Flutter scaffolds and installed tooling (2026-09-28)

- Read both governing documents in full; continued feature/passenger-phase1-v1. The manually reviewed Node web demo was preserved.
- Generated Android scaffolds only in apps/customer and apps/partner using Flutter 3.47.0 / Dart 3.13.0. Added flutter_test dependencies and lockfiles, app smoke tests, analysis configuration and debug-only cleartext HTTP for the loopback demo.
- Corrected an existing extra closing parenthesis in Partner offers and deprecated Flutter UI APIs.
- Installed tooling: Android SDK 37.0.0 at C:\Android\Sdk; Java Temurin 21.0.12; licenses accepted; Node 24.19.0; npm 11.17.0. No Android device connected. Visual Studio C++ absent; Windows desktop builds unsupported here.
- PASSED: flutter analyze in each Customer, Partner and cargox_ui package (no issues); Customer 1/1, Partner 1/1, UI 4/4 widget tests. npm run check:demo and npm test passed locally: 19/19.
- FAILED: Customer flutter build apk --debug: Gradle java.io.IOException: Unable to establish loopback connection before compilation. Investigation continues; no APK claimed.
- An accidental repository-root flutter analyze traversed untracked functions/node_modules Firebase templates and an unresolved new package; root flutter test had no test directory. Use per-package commands, not root Flutter commands.
- Preserved pre-existing untracked apps/customer_app, apps/partner_app, apps/admin_web, functions and packages/cargox_firebase; do not import or commit them.
- Next batch: shared API adapter, original vector vehicles, accessible service navigation, Auto/Car quote/status/schedule and unpaid recurring previews. Production gates remain unchanged.

## Batch E2 — Flutter navigation, original UI and local API wiring (2026-09-28)

- Customer: language/fallback, fictional login, manual permissions, city, all service entries, Auto/Car route/server quote/Pink preferences/unpaid confirmation, Schedule, trip status/start-code/receipt/history, Daily purposes, Monthly calendar/drafts and guardian/safety gates.
- Partner: demo login/role previews, onboarding/review/service/Pink/rate/selfie gates, eligible offers, accept, server OTP start/complete, workload/history and unpaid earnings. API errors display immediately.
- Original vector vehicles including open-cabin Auto, Mint Teal glossy cards, keyboard activation, spring tap (170ms), custom routes (170/210ms), one-shot reflection (220ms); OS reduced-motion support. No physical-device FPS claim.
- Injectable packages/cargox_demo loopback HTTP adapter with request deadlines; POST /api/quotes and GET /api/plans. Server now rejects impossible scheduled dates and ineligible Pink pack quotes. Reviewed web demo assets unchanged.
- Final scripts/Test-CargoX.ps1 EXIT 0: Node syntax and 22/22 tests; Flutter analysis no issues in all four packages; Customer 7/7, Partner 3/3, shared UI 7/7, adapter 2/2 tests (19 total); npm ci reported 0 vulnerabilities; Next typegen/TypeScript and Next 16.3.6 build; BOTH Android debug APK builds succeeded.
- Android fix: JAVA_TOOL_OPTIONS=-Djdk.net.unixdomain.tmpdir=C:/Projects/CargoX/.local-tmp. Default temp path failed in JDK AF_UNIX loopback initialization; IPv4 and alternate selector alone failed. Verification script restores the prior environment.
- Live Dart HTTP smoke PASSED on isolated port 4174: Auto immediate and scheduled Pink Car quote -> eligible offer -> accept -> customer code -> start -> complete -> Admin API; unpaid Pink pack saved/listed with four distinct legs. Not physical-device E2E evidence.
- Optional Flutter render task PASSED and Home/fare PNGs inspected at phone size. Earlier render harness blocked on fake-async image encoding; corrected with real-async capture. Segoe UI uses an installed Windows font, not a redistributed asset.
- Old API on 4173 preserved with its in-memory state. Updated API runs on 4174. Use adb reverse tcp:4174 tcp:4174 and --dart-define=CARGOX_DEMO_API=http://127.0.0.1:4174, or deliberately restart the old API after accounting for its state.
- Admin lockfile generated, dev/start restricted to 127.0.0.1:3001, configurable loopback API with 2.5s timeout. Ignored .env.local selects 4174. Earlier preview HTTP 200 verified. Browser permission DENIED visual inspection; not bypassed. Admin browser visual QA is unverified.
- Remaining: device walkthrough/performance, full translations, real auth/RBAC/maps/GPS/KYC/selfie/SOS, legal approvals, paid entitlements/refunds/settlement and staging RLS. No deployment, production migrations, real payments or live gates activated.
- Next batch: close route-motion/scaffold polish gaps and CI/handoff. Do not recreate the completed demo features above.

## Batch E3 — Admin navigation, Android integration and verification handoff (2026-09-28)

- Added all 11 read-only Admin sections: login/access, city/service switches, partner review, dispatch/incidents, fares, Pink permissions, Daily/Monthly oversight, GM/FO reports, payouts, audit and launch flags. The local API exposes illustrative pricing and sequenced fixture events without OTP secrets. No approval or payment mutation is enabled.
- Centralized Flutter replacement-route motion so entry transitions also honor both OS reduced-motion signals. Added original mint vector launcher icons and readable CargoX/CargoX Partner Android labels.
- Android emulator tests PASSED independently on Pixel_9 / Android 17 / emulator-5554: Customer 1/1 (UI request, assigned code and receipt with live local HTTP; counterpart Partner API actions simulated), Partner 1/1 (UI accept, server OTP/start and complete; counterpart Customer API actions simulated). This is emulator evidence, not a physical-device or two-app simultaneous session.
- Initial Customer integration attempt was interrupted during cold emulator startup/first native dependency resolution; its retry passed. Partner passed. The test emulator was shut down after both checks. Fictional API state was saved to ignored `.artifacts/e3-emulator-api-state.json` before refreshing only our isolated 4174 process. The user's older 4173 process and reviewed web assets were preserved.
- Live Dart HTTP smoke PASSED again after the API refresh: immediate Auto, scheduled Pink Car and unpaid four-leg Pink plan. Fixture data is in-memory and resets on server restart.
- Admin server-component checks PASSED for all 11 sections, unknown-route rejection, offline state, disallowed API origins and non-demo responses. Browser visual inspection remains unverified because browser access was denied; no alternative browser was used.
- Added documented API contracts and repeatable Android integration commands. CI now defines per-package Flutter analysis/tests and Admin typecheck/component/build jobs in addition to Node. New remote CI jobs are NOT verified: these commits have not been pushed.
- Final `.\scripts\Test-CargoX.ps1 -DemoApi http://127.0.0.1:4174` EXIT 0: Node syntax checks and 23/23 regressions; all four Flutter package analyses reported no issues; adapter 2/2, shared UI 8/8, Customer 7/7 and Partner 3/3 host tests (20 total); `npm ci` reported 0 vulnerabilities; Next type generation/TypeScript, all 11 section checks and Next build passed; BOTH normal Android debug APKs rebuilt after integration testing (Customer 45.2s, Partner 43.2s). These APKs target the isolated loopback API on 4174 and require `adb reverse tcp:4174 tcp:4174` on an Android test device.
- Separate final Dart format check: 16 app/shared/adapter source and test files, 0 changes. Phone-sized Home render was rerun successfully and inspected after the final vehicle/route polish. `git diff --check` passed.
- Local Admin `npm run start` reported Ready and its listener was confirmed on 127.0.0.1:3001; ignored `.env.local` selects 4174. No new browser/HTTP visual inspection was attempted after access denial. API 4174 is seeded with fictional smoke-test rides/draft; old API 4173 remains untouched. These running local processes are not persistent hosted services.

## Remaining work and external blockers after the local demo

- Secure pilot backend: real authentication, role/team-scoped authorization, transactional dispatch, persistence, scheduling and tested RLS. The existing SQL is a design migration only. No Docker, PostgreSQL or Supabase CLI is installed here; no staging backend has been configured. Do not expose the local unauthenticated API.
- Provider/operations dependencies: selected maps/router, SMS, identity/document and fresh-selfie providers; privacy/consent policies; GPS/share protections; incident ownership and staffed SOS; payment sandbox/webhook credentials, refunds and settlement policy. Live activation still requires approval.
- Service policy decisions: city and route permissions, Bike/Shared operating model, approved child handoff process, real tariffs/taxes, pack holidays/pauses/refunds and qualified replacements. Strict Pink preference must survive every replacement.
- Implementation backlog beyond the local preview: full Hindi/Marathi translations, real notifications, production trip tracking/support, atomic paid entitlements and renewal, production Outstation/Shared/Bike flows. These are not claimed complete or merely hidden behind working integrations.
- Verification still required: Admin browser visual QA, physical Android performance/accessibility walkthrough, release signing, iOS/macOS builds on supported tooling, staging integration/security/load tests and the expanded remote CI run. Windows desktop compilation is unsupported without Visual Studio C++.
- Next development batch: provision an approved isolated staging backend and implement the authenticated Auto/Car vertical slice with transactional acceptance and negative RBAC/RLS tests. Resolve the policy/provider decisions above before activating dependent services. Do not recreate completed local navigation or the reviewed Node demo.
