# PIP PIP Development Progress

Updated: 2026-09-28
Branch: `feature/passenger-phase1-v1`
Protocol: update this file **after each batch**; distinguish committed code from verified working features. Do not reset or repeat existing progress.

Current local status: E1–E3 remain verified; F2 adds a locally tested staging auth/onboarding/RLS foundation. The F1 asset and responsive UI patch is retained locally, uncommitted pending blocked browser visual QA, so it is excluded from the verified push. The production pilot is NOT complete. The latest results/dependencies are in F1/F2 below; earlier `CargoX` entries are historical implementation evidence, and current product-facing naming is PIP PIP by Mrunal Technologies.

## Phase 1 scope and non-negotiable constraints

Fresh PIP PIP build; no old code/database reused. Bike, Auto, Car, Outstation incl Daily Car, Shared Car; Pink Rider preferences; Schedule, Daily and Monthly fixed-route packs. Phase 2 goods logistics deferred. Mint #59BAA1 glossy, smooth, accessible UI. Sensitive service and legal claims remain launch-gated.

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

## Batch C — true pilot (foundation started in F2; pilot incomplete)

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
- Root npm test uses explicit demo test filenames after F2, avoiding Windows glob expansion and unrelated package dependency discovery.

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

## Remaining work at E3 (foundation progress updated in F2 below)

- Secure pilot backend: real authentication, role/team-scoped authorization, transactional dispatch, persistence, scheduling and tested RLS. The existing SQL is a design migration only. No Docker, PostgreSQL or Supabase CLI is installed here; no staging backend has been configured. Do not expose the local unauthenticated API.
- Provider/operations dependencies: selected maps/router, SMS, identity/document and fresh-selfie providers; privacy/consent policies; GPS/share protections; incident ownership and staffed SOS; payment sandbox/webhook credentials, refunds and settlement policy. Live activation still requires approval.
- Service policy decisions: city and route permissions, Bike/Shared operating model, approved child handoff process, real tariffs/taxes, pack holidays/pauses/refunds and qualified replacements. Strict Pink preference must survive every replacement.
- Implementation backlog beyond the local preview: full Hindi/Marathi translations, real notifications, production trip tracking/support, atomic paid entitlements and renewal, production Outstation/Shared/Bike flows. These are not claimed complete or merely hidden behind working integrations.
- Verification still required: Admin browser visual QA, physical Android performance/accessibility walkthrough, release signing, iOS/macOS builds on supported tooling, staging integration/security/load tests and the expanded remote CI run. Windows desktop compilation is unsupported without Visual Studio C++.
- Next development batch: provision an approved isolated staging backend and implement the authenticated Auto/Car vertical slice with transactional acceptance and negative RBAC/RLS tests. Resolve the policy/provider decisions above before activating dependent services. Do not recreate completed local navigation or the reviewed Node demo.

## Batch F1 — synchronization audit and local UI candidate (2026-09-28; browser QA blocked)

- Read the complete master prompt and this progress log. Started from verified local commit `e6091ac` on `feature/passenger-phase1-v1`. `git fetch origin` succeeded: 3 local commits ahead, 0 behind; no tracked local modifications and no divergence. No reset, clean, rebase or force push was used.
- Inventoried and SHA-256 hashed 42 pre-existing untracked files under `apps/customer_app`, `apps/partner_app` and `functions`; their hashes remain unchanged. Ignored legacy artifacts were left in place. Audit manifest is local-only `.artifacts/pre-f4-untracked-audit.json`.
- Replaced the remaining web vehicle emoji glyphs with five original glossy SVGs and a deterministic generator. Existing Flutter vector artwork and booking flows were preserved. Added allowlisted SVG routes and verified MIME/404 responses through the actual demo HTTP server. Asset contact sheet rasterized with Sharp and visually inspected; no browser rendering was used for that inspection.
- Source-level UI corrections: narrow header/form/grid wrapping, higher-contrast captions/unavailable states, focusable Admin skip target, responsive Admin metrics and reduced-motion hover suppression. See `docs/VEHICLE_ASSETS.md` and `docs/VISUAL_QA.md`.
- To honor “commit and push only verified changes,” these browser-facing changes stay **uncommitted locally** until screenshot/viewport QA can run. This includes Admin CSS/layout, demo HTML/CSS/JS/server SVG routes, asset-serving assertions in `tests/api.test.mjs`, the SVGs/generator, the vehicle-art document and its README note. Do not discard or recreate them. Only the independent, tested backend foundation is being committed/pushed in this continuation.
- Browser QA is still BLOCKED. Opening local Admin in the browser tool was rejected by the saved user permission. The user said they would enable access; one recheck returned the same saved-permission rejection. No alternate browser, raw browser commands or screenshot workaround was used. No browser screenshots or responsive-viewport pass is claimed.
- PASSED: `.\scripts\Test-CargoX.ps1 -SkipAndroid` exited 0: demo syntax and 23/23 Node tests; staging 26/26; all four Flutter analyses clean and adapter 2/2, UI 8/8, Customer 7/7, Partner 3/3 (20 total); Next type generation/TypeScript, all 11 section checks and build. Admin/staging installs both reported 0 vulnerabilities. Live Dart API smoke and optional Flutter render 1/1 passed separately.
- Android rerun attempt 1: Customer integration APK built/installed, then the emulator disappeared during the running test. Flutter exited 1: `device 'emulator-5554' not found`, followed by listener-directory cleanup errors. No app assertion pass/fail was produced. Windows Application Event 1000 identified `qemu-system-x86_64-headless.exe` crashing at 23:41:46 with exception `0xc0000005`, unknown faulting module. Retried with a fresh read-only emulator/two cores; requested 2048 MB, but the Android image enforced 4096 MB. Customer retry PASSED 1/1 in 56s. The first Partner retry then failed before UI interaction with `HttpException: Connection closed before full header was received`; diagnosis showed only our disposable 4174 API had stopped, while the preserved 4173 process remained healthy. Restarted only 4174, reapplied `adb reverse`, and Partner PASSED 1/1 in 12s. Both normal debug APKs were then rebuilt with `CARGOX_DEMO_API=http://127.0.0.1:4174`: Customer 36.8s, Partner 30.0s. SHA-256 build manifest is ignored at `.artifacts/f2-apk-manifest.json`. The test emulator was shut down after the runs.
- Preserved the older API on 4173. Saved our fictional 4174 state to `.artifacts/f1-api-before-refresh.json` before restarting only that process with current SVG routes. Test fixture state is ephemeral; do not use the old process for new asset QA.

## Batch F2 — separate staging identity and onboarding foundation (2026-09-28)

- Added `apps/staging-api` with pinned Supabase client, a real provider OTP request/verification adapter, per-request `getUser` verification, same-user JWT database calls, narrow field validation, body/time limits, process-local rate limits and private error responses. It never uses a service-role client or the demo engine. No app was switched to staging.
- Added an additive transactional SQL migration for customer consent, partner application/document-reference collection, protected staff roles/FO teams, MFA-gated scoped reads/reviews, required Staff then independent Admin approval, current trusted-verification checks and append-only audit. Approval cannot put a partner online or enable a service. The original domain migration is unchanged.
- PASSED: 26/26 staging tests: 15 PostgreSQL migration/RLS tests, 8 HTTP integration tests and 3 adapter/config tests. Both actual migration files were executed in disposable PostgreSQL 18.3 / PGlite 0.5.8 (wasm32) with pgcrypto and a minimal test-only Supabase auth contract. Ephemeral signed JWT fixtures test HTTP identity rejection. These are not hosted Supabase/Auth/PostgREST/Storage integration results.
- Refined the auth outage path to return 503 without exposing provider details, instead of misreporting an outage as an invalid session. Re-ran staging syntax and all 26 tests successfully after this final server change.
- `npm ci` for staging reported 0 vulnerabilities. `npm run check` passed. `npm start` without configuration intentionally exited 1 with `CARGOX_ENV=staging is required; demo fallback is forbidden`. No external auth provider call, real SMS, hosted migration, deployment or payment occurred.
- Added `docs/STAGING_FOUNDATION.md` with exact setup, routes, primary documentation links, threat boundaries and remaining dependencies. Expanded the verifier and CI with a separate staging suite. Root `npm test` explicitly runs the original two demo test files so unrelated package dependencies cannot contaminate the zero-dependency demo job.
- Still pending: approved isolated Supabase project/configuration; hosted migration review and real JWT/PostgREST RLS tests; SMS/captcha and staff MFA; audited operator bootstrap; private Storage, scanning/retention and trusted verification; refresh/sign-out and staged app adapters; native PostgreSQL concurrency/security/load checks. PGlite is local database evidence, not a replacement for those integrations.
- Verified foundation commit `3cd6ca0` was pushed to `origin/feature/passenger-phase1-v1` without force. The browser UI candidate remains intentionally uncommitted locally pending its blocked screenshot/viewport QA; all preserved legacy artifacts remain untouched.

## Batch F3 — PIP PIP product rebrand, CI repair and staging response hardening (2026-09-29)

- Audited `feature/passenger-phase1-v1` at `38ad919`; `git fetch origin` reported 0 ahead and 0 behind before this batch. All pre-existing F1 glossy SVG artwork, generator, responsive CSS/HTML/JS changes and legacy untracked folders remain present and are deliberately excluded from this verified commit pending authorized browser visual review.
- Rebranded the user-facing product to **PIP PIP** and company to **Mrunal Technologies**. Flutter uses `PipPipBrand`; Admin uses `apps/admin/lib/brand.ts`; Customer and Partner Material titles, Android launcher labels, splash/launcher PIP mark, local-demo metadata/logs and documentation use the approved display names. The Mint Teal theme, motion behavior, booking flows, Pink Rider safeguards and their public-safe wording were not changed.
- Added `docs/BRANDING.md`, including the selected internal Pink Rider tagline, its unpublished status, and the compatibility-sensitive identifiers retained as technical `cargox` names (Dart/import symbols, Android application IDs, API/environment names, schema/migration names, folders and remote). No package, API, database or remote rename was attempted.
- Inspected latest remote CI runs. The four prior runs failed only because the workflow checked out a raw shallow Flutter commit; hosted `flutter pub get` identified it as `0.0.0-unknown` and rejected Flutter SDK constraints. Demo-domain, Admin and staging jobs had passed. CI now checks out the verified Flutter `3.47.5` release tag so its SDK metadata is available to pub; the post-push result is recorded below.
- PASSED: post-push GitHub Actions run `36470351008` completed successfully. Demo-domain, staging foundation, Admin and all four Flutter matrix jobs passed; the CI repair resolved the prior `0.0.0-unknown` Flutter SDK failure. The runner emitted only upstream Node 20 action-deprecation and future Ubuntu-image migration notices.
- Hardened the local staging foundation response contract without requiring credentials: every JSON response now has no-store, nosniff, all-deny CSP, no-referrer, frame denial, same-origin resource policy and an explicit no camera/geolocation/microphone permissions policy. Added HTTP assertions. Hosted authentication, remote migrations, payments and deployment remain untouched.
- PASSED: `./scripts/Test-CargoX.ps1 -DemoApi http://127.0.0.1:4174` exited 0 after the rebrand: 23/23 Node regressions; 26/26 staging checks/RLS tests; clean analysis for all four Flutter packages; adapter 2/2, UI 9/9, Customer 7/7 and Partner 3/3 host tests; Admin type generation/TypeScript, all 11 section checks and Next build; Customer and Partner Android debug APKs built successfully (17.8s and 17.7s). The focused post-hardening rerun also passed Node 23/23 plus staging check and 26/26 tests. `git diff --check` passed.
- Android device integration is not claimed for this batch. Customer integration built and installed the rebranded APK, then `emulator-5554` disappeared before an assertion result. One fresh read-only, two-core retry stayed `device`-listed but never returned `sys.boot_completed=1`; it was shut down. Partner integration was not run after this host failure. This is the same Windows emulator instability previously observed, not an app assertion failure.
- Browser visual QA remains blocked by the saved local-browser permission. No workaround or screenshot claim was made. Needed next action: authorize the existing browser surface for the local Admin/demo URLs, then perform the pending responsive screenshot review before committing the F1 artwork/UI candidate.

## Batch F4 — Android lifecycle privacy regression and reproducible QA (2026-09-29)

- The previous PIP PIP rebrand and security-gated staging foundation were preserved. The uncommitted local F1 web SVG artwork, responsive layout changes and legacy untracked directories were **not touched**: F4 changes only tracked Customer/Partner Flutter source and widget tests, plus a new isolated Android QA document.
- Customer TripPage now observes Android/Flutter app lifecycle: it clears any visible fictional start code as soon as the app becomes inactive/backgrounded. Resuming alone never reveals the code; an explicit refresh is required. A delayed code response cannot reveal the code while the app is backgrounded. This is local demo UI privacy; the separate production token/auth solution is not yet integrated.
- PartnerTrip observes the lifecycle and erases any partly/completely typed code whenever the app is inactive. Its four-digit field accepts digits only, with suggestions and autocorrection disabled. All final eligibility/attempt limits remain on the server; this is not an authentication replacement.
- Added one focused widget regression to each app for those lifecycle behaviors; manual physical-device testing is still required. The existing local user-run 23 Node, 26 staging and 21 Flutter test results **predate** these changes and must not be cited as F4 pass results.
- Added [docs/PIP_PIP_ANDROID_QA.md](PIP_PIP_ANDROID_QA.md) with the selected 4174 debug-API/adb-reverse procedure, privacy/Pink Rider walkthrough and a diagnostic stop condition for the Windows emulator boot/crash blocker.
- GitHub Actions F4 verification **passed** at [run 36474756309](https://github.com/mrunalenterprises/cargox/actions/runs/36474756309): all seven jobs succeeded (demo, staging, Admin and four Flutter packages). Android debug APKs were then rebuilt and verified by the independent F5 workflow described below. Admin browser visual QA remains blocked by saved user permission; the F1 candidate is still local/uncommitted.
- After verifying green CI, safely fetch/fast-forward this remote branch on the developer laptop without overwriting uncommitted F1 assets. Run the full local verifier, rebuild both APKs and run the device checklist on a stable authorized emulator or real Android test phone. Do not merge the draft PR or deploy while security and operational work remain incomplete.

## Batch F5 — independently verified Android debug APK builds (2026-09-29)

- Added an independently triggered, branch-scoped `.github/workflows/android-debug.yml` that installs JDK 21 and pinned Flutter 3.47.5, executes `flutter analyze` and `flutter test` before building each Customer/Partner debug APK with **fictional loopback-only** `CARGOX_DEMO_API=http://127.0.0.1:4174`. It publishes short-lived artifacts with actual APK checksums; do not distribute these as live apps.
- [GitHub Actions run 36475086991](https://github.com/mrunalenterprises/cargox/actions/runs/36475086991) completed **successfully** with **both Android build jobs passing**. Its source SHA is `8561cd7d240ead42ed08444e5b69cd711263e889` (the subsequent companion PowerShell script and this documentation do not alter app source).
- Customer APK test artifact: `pip-pip-customer-debug`, artifact ID `10994195190`; embedded `app-debug.apk` SHA-256: `3b29ec1e44358ffa33d73c73f019829495f5023768aaf235663713da402cd640`.
- Partner APK test artifact: `pip-pip-partner-debug`, artifact ID `10993581210`; embedded `app-debug.apk` SHA-256: `2ab91315c2fcc994422f4ab2aac1e0ae320e8f82af6147b1efc4addaf154515d`.
- Both ZIP artifacts are listed on the run's Artifacts panel and expire **2026-10-03 around 19:55 UTC**. The workflow includes `SHA256SUMS.txt` with each APK. Log-in may be required to download. If expired, manually re-run the workflow on the same reviewed branch and compare the new results.
- Added `scripts/Check-PipPip-Device.ps1`: safe read/port-forward checks for exactly one authorized USB phone or emulator; `-InstallDebugApks` explicitly opts into replacing only the two named debug packages using `adb install -r`. It does not kill existing API processes, reset devices or touch local pending F1 files. See `docs/PIP_PIP_ANDROID_QA.md` for the on-device flow.
- **Not yet verified:** installing and exercising these new artifacts on a physical Android phone; same-time Customer and Partner UI sessions, independent lifecycle/privacy interaction, device performance, live backend/maps/KYC/payment and Admin visual QA. The debug artifacts are not signed release APKs and the 4174 local-only test API requires explicit USB `adb reverse tcp:4174 tcp:4174`.
- The F1 glossy SVG asset candidate, responsive web/Admin edits and pre-existing untracked legacy files on the developer's laptop remain **uncommitted and untouched** by these remote-only GitHub operations. Safely inspect `git status` before any laptop fetch/merge; do not run clean/reset/force pull.


## Batch F6 — direct Android phone screenshot review and offline-friendly UI (2026-09-29)

- The user installed and opened both prior PIP PIP Android APKs **without USB** on a physical Samsung Android phone, and supplied screenshots. The Partner screen showed an actual `Local API unavailable` error pointing incorrectly at port 4173, an empty offer section, and a second duplicate snackbar. The Customer welcome/Partner screen also had unusually large white areas and the current vehicle illustrations are clearly 2D vectors, **not** the approved future high-end 3D models.
- The source issue is not a failed installation: both APKs compile and open, but their `CARGOX_DEMO_API` target is a loopback test service. A normal phone copied APK cannot reach the laptop's 127.0.0.1. No unauthorized LAN/Internet exposure, server fallback, or fictional online booking was introduced.
- Added a responsive shared Mint Teal `PipPipHero` that groups illustration and text in one compact glossy card on phone-width layouts, using existing lightweight vector illustrations as an interim asset. Integrated it into the Customer Welcome/Home and Partner Entry/Home without changing route/booking logic, reduced-motion policy, or gated services.
- Added `PipPipOfflineNotice`; Partner refresh and offer-accept errors now have a single persistent inline state rather than duplicate banner + snackbar. No false “no available rides” message appears when network data cannot load. Customer welcome explicitly identifies an offline preview.
- The local demo transport error now reports its **actual compiled configurable port** instead of hard-coding 4173; the user can browse static screens without a cable, but the current demo cannot create bookings on a disconnected Android phone. Regression tests cover this copy and connection-failure classification plus narrow-screen layout and offline navigation.
- The local pending glossy SVG web changes and untracked legacy files are **not modified** by remote-only F6 commits. Current Flutter artwork remains 2D: obtaining and integrating approved original 3D vehicle assets is a **separate unfinished UI task**, not a falsely completed deliverable. Admin Browser Use remains restricted for 3001; F6 has no claim of a passed browser screenshot audit.
- [F6 Flutter/Node/Admin/Staging CI](https://github.com/mrunalenterprises/cargox/actions/runs/36522195058) and [F6 independently rebuilt debug APK workflow](https://github.com/mrunalenterprises/cargox/actions/runs/36522187069) were queued/in progress when this text was written. Check final status and artifact hashes before recommending any new download. The earlier F5 APKs do **not** include these F6 code changes.
- **Next integration prerequisite:** obtain explicit approval and isolated HTTPS Supabase staging details (correct project reference, publishable key, configured SMS/captcha provider, staff MFA, and consent/storage decisions). Review/apply migrations on a disposable staging copy and run real hosted JWT/PostgREST/storage tests before switching Android clients. Do not expose the unauthenticated local demo to a LAN/public server as an alternative to proper staging authentication.
