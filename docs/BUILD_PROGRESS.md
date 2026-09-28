# CargoX Development Progress

Updated: 2026-09-28
Branch: `feature/passenger-phase1-v1`
Protocol: update this file **after each batch**; distinguish committed code from verified working features. Do not reset or repeat existing progress.

## Phase 1 scope and non-negotiable constraints

Fresh CargoX build; no old code/database reused. Bike, Auto, Car, Outstation incl Daily Car, Shared Car; Pink Rider preferences; Schedule, Daily and Monthly fixed-route packs. Phase 2 goods logistics deferred. Mint #59BAA1 glossy, smooth, accessible UI. Sensitive service and legal claims remain launch-gated.

## Batch A — repository audit and written contracts

- [x] Verified `main` had master build prompt and minimal README; created separate feature branch and did not modify `main`.
- [x] `docs/DECISIONS.md`, `docs/ARCHITECTURE.md`, `docs/SCREENS.md` added with explicit unresolved policy questions.
- [x] Added scope/limitations and Windows developer instructions to `README.md`.
- [ ] Verify the complete master prompt's versions with installed stable SDKs on developer laptop.
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
- [ ] **Node test verification:** code and tests committed, but a full actual Node/GitHub Actions run is required. Earlier non-Node in-isolate logic check was 14/14 with fake crypto; that is **not** equivalent to runtime test success. On 2026-09-28 the current domain, demo server, browser JS, domain tests and API tests all passed **syntax parsing in an isolated JavaScript runtime after stripping module syntax/import.meta**; exact real Node CI status still unverified.
- [ ] Flutter SDK project platform files, actual `flutter analyze`, `flutter test` and Android device build. Local Flutter install needed.
- [ ] Next `npm install`, `tsc` typecheck and `next build`; pin actual resolved patched versions/lockfile after install.
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

## Tests and status (do not embellish)

- The source and test suite have been written to GitHub on feature branch. `npm test`, `npm run check:demo`, Flutter analysis and Next build have **not** yet been verified in the actual Node/SDK environment at the time this record was authored.
- If CI is green later, add run URL and date. If it fails, record the exact error and fix in this branch.
- The local demo is in-memory, unauthenticated and binds to 127.0.0.1; it must not be deployed.

## Next exact developer action

Run CI / tests on feature branch, correct any failures. On Windows after fetching and safely switching to the branch:

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
