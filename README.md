# PIP PIP — Phase 1 Passenger Mobility

**Mrunal Technologies · clean-slate rebuild · development only**

**Current branch:** `feature/passenger-phase1-v1` (no legacy implementation or old backend reused).
**One-prompt requirements:** [docs/CARGOX_MASTER_BUILD_PROMPT.md](docs/CARGOX_MASTER_BUILD_PROMPT.md)
**Actual development state:** [docs/BUILD_PROGRESS.md](docs/BUILD_PROGRESS.md)

This is a development project, **not** a live ride-hailing system. Public safety, driver verification, real payments, legal approval, emergency response, and secure production authentication remain unimplemented or unapproved.

## Phase boundaries

Phase 1 passenger services: Bike, Auto Rickshaw, Car, Outstation (One Way, Round Trip, Daily Car), and Shared Car. Include Pink Rider selection; Book Now, Schedule, Daily/Recurring, and fixed-route Monthly Ride Packs. Daily purposes include Office, College, Classes and (only after specific child-safety approvals) School. Phase 2 defers all goods transport, trucks, courier and logistics.

## What is runnable today

A **loopback-only, zero-dependency Node 22 demo** provides one glossy web preview with Customer, Driver and Admin tabs and in-memory domain logic. In the demo, Auto and Car are enabled; other service cards say Coming Soon pending their own implementation and launch gates.

Demo functionality:
- Auto or Car Book Now / scheduled booking request and indicative quote from manually entered demo km.
- Pink Rider Only preference with strict matching to a fictional opted-in verified woman driver; no automatic fallback.
- Eligible fictional driver offers, accept, one-time 4-digit demo OTP, start and complete, Admin counters.
- Daily/Monthly fixed-route unpaid preview with chosen weekdays and separate outbound/return legs.
- Layout includes Mint Teal glossy cards and reduced-motion rules.

The demo is **not production security**. `/api/demo/customer-code` reveals OTP without authentication for local testing only. All demo partner approvals are fictional; never put real personal, child, financial or location data into it. No live maps, payment, SMS, real verified KYC, driver tracking or incident service.

The separate `apps/staging-api` now provides a Supabase Auth adapter, narrow onboarding endpoints and database-owned Staff/Admin permissions. Its migration and RLS/HTTP tests run locally against disposable PostgreSQL via PGlite. Hosted Supabase, SMS/captcha, private document storage and trusted verification are **not connected**. See [staging setup, contracts and limitations](docs/STAGING_FOUNDATION.md).

```powershell
npm --prefix apps/staging-api ci
npm run test:staging
```

`npm test` deliberately runs only the existing zero-dependency demo suite; the staging package has its own pinned dependencies and CI job. `scripts/Test-CargoX.ps1` (a retained technical script name) runs both suites before Flutter/Admin checks and Android compilation.

[Visual QA status](docs/VISUAL_QA.md) records the browser permission blocker. The vehicle-art and responsive UI candidate is retained locally, excluded from the verified backend push until screenshot/viewport QA can run.

## Start locally (Windows PowerShell)

If this repository has already been cloned into an empty `C:\Projects\CargoX` folder:

```powershell
cd C:\Projects\CargoX
git status
git fetch origin
git switch --track origin/feature/passenger-phase1-v1
node --version   # Requires Node.js 22+
npm run check:demo
npm test
npm run dev:demo
```

If the feature branch already exists locally, use `git switch feature/passenger-phase1-v1` instead. **If `git status` displays local edits, save or commit them before switching.** Never delete/reset anything automatically.

Open <http://127.0.0.1:4173> on the **same laptop**. This demo intentionally binds only to `127.0.0.1` and must not be forwarded to the internet.

### Demo walkthrough

1. Customer: request an Auto/Car ride from manually entered pickup/drop and example km. To request Pink Rider, select both demo eligibility and Pink Rider Only.
2. Driver: refresh eligible offers. Choose a driver whose eligibility matches the request. Accept.
3. Customer: open assigned ride and show the **local-only** OTP.
4. Driver: enter ride ID and the OTP, start, then complete the ride.
5. Admin: refresh to see the resulting status. Customer: use Daily/Monthly form for *unpaid* estimates.

Restarting the Node process clears all in-memory demo bookings and fake partners.

## Flutter apps and Next.js Admin

Customer (`apps/customer`) and Partner (`apps/partner`) have Android scaffolds, tested navigation and local API flows. Shared `packages/cargox_ui` supplies original vector vehicle art, glossy cards, keyboard activation and 170–220ms motion with OS reduced-motion support. `packages/cargox_demo` supplies an injectable, loopback-restricted HTTP adapter.

Verified toolchain: Flutter 3.47.0, Dart 3.13.0, Android SDK 37.0.0, Java 21.0.12, Node 24.19.0, npm 11.17.0. Android debug APKs are development artifacts, not release-ready apps. No physical-device performance result is claimed.

### Run Android locally

Start the API in a separate terminal (`npm run dev:demo`). Use USB/emulator reverse forwarding so the unauthenticated API stays on the laptop loopback interface:

```powershell
cd C:\Projects\CargoX
& C:\Android\Sdk\platform-tools\adb.exe reverse tcp:4173 tcp:4173
cd apps\customer
flutter pub get
flutter run
# In another terminal, use the same commands in apps\partner.
```

Both apps default to `http://127.0.0.1:4173`. Android cleartext is allowed only in debug manifests. The adapter also permits the emulator host `http://10.0.2.2:4173` via `--dart-define=CARGOX_DEMO_API=http://10.0.2.2:4173`; arbitrary remote origins are rejected.

An older manually reviewed demo is currently preserved on 4173. The updated API was started separately on 4174 to avoid clearing its data. To use that process:

```powershell
& C:\Android\Sdk\platform-tools\adb.exe reverse tcp:4174 tcp:4174
flutter run --dart-define=CARGOX_DEMO_API=http://127.0.0.1:4174
```

To start the updated API on another port, set `$env:PORT='4174'` before `npm run dev:demo`. Never terminate a running demo just to reclaim its port without accounting for its in-memory state.

### Customer and Partner walkthrough

1. Customer: language → fictional sign-in → manual-location choice → demo city → Auto/Car. Enter route/distance, optionally schedule, and fetch the server quote.
2. Choose Pink Rider Only if desired and the fictional eligible-passenger fixture. Explicitly consent to a demo request. No payment is taken.
3. Partner: enter demo, select the matching seeded partner, refresh offers and accept. In Customer, refresh the trip to retrieve its code.
4. Partner: validate the code, start, complete. Customer refreshes for an unpaid receipt. History, scheduled workload and Admin reflect server state.
5. Daily/Monthly: choose weekdays, fixed route, date range, independent return time and preference. Preview distinct legs, save an unpaid draft and reopen its calendar in My Monthly Packs. No entitlements or dispatch are created.

Bike, Shared Car, Outstation One Way/Round Trip/Daily Intercity and guardian journeys have explicit gated navigation. Live partner onboarding, selfie, pricing, GPS, sharing, SOS and payout screens explain the missing integration rather than pretending to operate it. Full Hindi/Marathi translation is pending; onboarding has localized copy and detailed screens use English fallback.

### Admin preview

```powershell
cd C:\Projects\CargoX\apps\admin
npm ci
npm run typecheck
npm run build
npm run dev
```

Open `http://127.0.0.1:3001`. Both `dev` and `start` bind to loopback. `npm run start` serves the built preview. Next 16.3.6, React/React DOM 19.2.0 and transitive packages are locked. Server-side `CARGOX_DEMO_API` defaults to port 4173 and rejects remote origins; see `.env.example`. This session's ignored `.env.local` selects 4174. The read-only preview has no production login/RBAC. Browser visual verification was denied in this session; TypeScript/build and an earlier HTTP 200 response were verified.

### Verify and build

```powershell
cd C:\Projects\CargoX
.\scripts\Test-CargoX.ps1
# Use this session's isolated API for the final APKs:
.\scripts\Test-CargoX.ps1 -DemoApi http://127.0.0.1:4174
# Omit Android compilation on hosts without the SDK:
.\scripts\Test-CargoX.ps1 -SkipAndroid
```

The script fails at the first failed check. On this Windows host the JDK initially failed to establish its Unix-domain loopback socket. The script uses the ignored short `.local-tmp` directory via `JAVA_TOOL_OPTIONS` and restores the previous environment afterward. Successful APK locations:

- `apps/customer/build/app/outputs/flutter-apk/app-debug.apk`
- `apps/partner/build/app/outputs/flutter-apk/app-debug.apk`

The final E3 APKs were rebuilt with `CARGOX_DEMO_API=http://127.0.0.1:4174` after both emulator integration tests passed. They contain the normal app entrypoints. Keep the isolated API running and configure `adb reverse tcp:4174 tcp:4174` for each connected Android test device. Full results and production blockers are in `docs/BUILD_PROGRESS.md`.

Admin also provides read-only navigation for login/access, city/service controls, partner review, dispatch/incidents, fares, Pink permissions, recurring plans, GM/FO reports, payouts, audit and launch flags. `npm run check:sections` renders all 11 server components against fictional fixtures and checks invalid routes, offline responses and API-origin guards. It does not replace browser visual QA.

### Android integration checks

Use a dedicated local fixture API with no concurrent manual bookings. Start an installed emulator or connect an authorized test device, then:

```powershell
cd C:\Projects\CargoX
& C:\Android\Sdk\platform-tools\adb.exe devices -l
& C:\Android\Sdk\platform-tools\adb.exe -s emulator-5554 reverse tcp:4174 tcp:4174
$env:JAVA_TOOL_OPTIONS='-Djdk.net.unixdomain.tmpdir=C:/Projects/CargoX/.local-tmp'
cd apps\customer
flutter test integration_test/local_journey_test.dart -d emulator-5554 --dart-define=CARGOX_DEMO_API=http://127.0.0.1:4174
cd ..\partner
flutter test integration_test/local_journey_test.dart -d emulator-5554 --dart-define=CARGOX_DEMO_API=http://127.0.0.1:4174
```

Substitute the connected device ID. These tests create fictional local rides; Customer tests simulate Partner API actions and Partner tests simulate Customer API actions. They do not verify SMS, maps, real identity, payment or physical-device performance. See BUILD_PROGRESS for actual run results. Run `flutter build apk --debug` again after integration testing to produce normal app APKs instead of test-entry APKs.

The CI workflow retains Node tests and adds Flutter analysis/widget-test jobs at the verified SDK revision plus pinned Admin typecheck/component/build checks. No new remote CI result is claimed until a pushed run completes.

Optional Windows phone-sized UI rendering: from `apps/customer`, run `flutter test tool/render_preview_test.dart`. It uses the locally installed Segoe UI font without redistributing it and writes PNGs under ignored `.artifacts/`. This is a render-inspection task, not a physical-device benchmark.

Do not reuse the pre-existing untracked `customer_app`, `partner_app`, `admin_web`, Firebase or `functions` artifacts. The canonical apps are `customer`, `partner` and `admin`.

## Tests and release gates

`npm run check:demo` validates basic JavaScript syntax; `npm test` runs domain/API tests (including trip code reuse, driver overlaps, Pink Rider fallback and monthly return legs). CI is defined in `.github/workflows/test.yml`; see [actual verified status](docs/BUILD_PROGRESS.md).

No public deployment or live child rides. Before production, implement audited JWT/RBAC and RLS, city-specific regulatory/permit approvals, real authentication and consent, official map/routing price calculation, licensed vehicle and driver onboarding, protected Trip OTP, secure realtime GPS/location-share, real transactional matching and plan entitlements, transparent charges/refunds, payment webhook verification/settlement, staffed SOS and complete device/load/security tests. Do not advertise the unverified "World’s 1st" tagline until substantiated.

## One prompt for subsequent Codex sessions

```text
Read docs/CARGOX_MASTER_BUILD_PROMPT.md and docs/BUILD_PROGRESS.md. Audit Git status and the current branch, continue the first incomplete batch on feature/passenger-phase1-v1, implement real working code with tests and update BUILD_PROGRESS.md. Never repeat completed verified work, destroy local work or silently claim production features are live.
```
