# CargoX — Phase 1 Passenger Mobility

**Mrunal Technologies · clean-slate rebuild · development only**

**Current branch:** `feature/passenger-phase1-v1` (no legacy CargoX code or old backend reused).
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

## Mobile and web app scaffolds

The repository also contains Flutter Customer and Partner prototype source and reusable Flutter glossy card/theme source, plus a Next.js Admin preview. These are **scaffolds requiring installed SDKs**, not confirmed ready-to-distribute APKs.

- Flutter customer: `apps/customer`; driver: `apps/partner`; shared UI: `packages/cargox_ui`.
- Admin: `apps/admin`. Its server fetches the local demo API for read-only counters.
- Backend schema design: `supabase/migrations`. **Not deployed anywhere.**

On your laptop first run `flutter doctor`. Generate Android platform folders only if missing; preserve existing `pubspec.yaml` and `lib/main.dart` when scaffolding with Flutter. Then `flutter pub get`, `flutter analyze`, `flutter test`, and `flutter run` per app. The Android Emulator uses `10.0.2.2` to reach the laptop's demo API. If Android cleartext HTTP blocks the local demo, allow it in the **debug-only Android manifest**, never production.

For Admin (requires packages):

```powershell
cd C:\Projects\CargoX\apps\admin
npm install
npm run typecheck
npm run build
npm run dev
```

The installed Next/React versions must be checked and patched as needed. The preview requires the local demo server running separately on port 4173; Admin dev server normally runs on port 3000.

## Tests and release gates

`npm run check:demo` validates basic JavaScript syntax; `npm test` runs domain/API tests (including trip code reuse, driver overlaps, Pink Rider fallback and monthly return legs). CI is defined in `.github/workflows/test.yml`; see [actual verified status](docs/BUILD_PROGRESS.md).

No public deployment or live child rides. Before production, implement audited JWT/RBAC and RLS, city-specific regulatory/permit approvals, real authentication and consent, official map/routing price calculation, licensed vehicle and driver onboarding, protected Trip OTP, secure realtime GPS/location-share, real transactional matching and plan entitlements, transparent charges/refunds, payment webhook verification/settlement, staffed SOS and complete device/load/security tests. Do not advertise the unverified "World’s 1st" tagline until substantiated.

## One prompt for subsequent Codex sessions

```text
Read docs/CARGOX_MASTER_BUILD_PROMPT.md and docs/BUILD_PROGRESS.md. Audit Git status and the current branch, continue the first incomplete batch on feature/passenger-phase1-v1, implement real working code with tests and update BUILD_PROGRESS.md. Never repeat completed verified work, destroy local work or silently claim production features are live.
```
