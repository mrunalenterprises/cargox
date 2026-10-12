# LOADIN Integration Audit

Date: 2026-10-12
Branch: `loadin-build`

## Current repository health

- Customer Web scaffold exists under `apps/customer-web`.
- Partner Web scaffold exists under `apps/partner-web`.
- Admin Web scaffold exists under `apps/admin-web`.
- Fleet/Business Web scaffold exists under `apps/fleet-web`.
- Domain modules and Node tests exist for Steps 9–32.
- GitHub Actions CI now runs migration continuity first and domain tests second.

## Critical finding

The migration directory currently starts at `009_partner_reviews_quality.sql` and continues through `032_full_shifting_workflow.sql`.

Foundation migrations `001` through `008` are missing from this GitHub branch.

This is a deployment blocker for a clean/fresh LOADIN Supabase database because later migrations assume core objects such as `public.bookings` already exist. Example: migration 020 reads `public.bookings` inside RLS policies.

## Deployment status

**Do not apply migrations 009–032 to a fresh production database yet.**

The safe next step is to restore/rebuild migrations 001–008 covering the original foundation:

1. Core profiles / roles / service catalog
2. Customer booking core
3. Route + Fare Lock snapshots
4. Partner dispatch / booking offers
5. Trip lifecycle + OTP + proof
6. Live tracking / trip share foundation
7. Partner earnings / settlement foundation
8. Customer payment foundation

After 001–008 are restored, `node scripts/check-migrations.mjs` must pass before live deployment.

## CI behavior

`.github/workflows/loadin-ci.yml` intentionally fails the migration-continuity step while 001–008 are missing. This prevents a false green build and protects against deploying an incomplete schema chain.

Node domain tests are configured after the migration guard. They should only be called passing after a real workflow run or local runner confirms them.

## Stale repository content

`docs/CARGOX_MASTER_BUILD_PROMPT.md` is inherited legacy CargoX content and is not the LOADIN product source of truth. It remains untouched to avoid destructive cleanup before explicit repository cleanup approval.

## Next build action

Rebuild/restore migrations 001–008 on `loadin-build`, then re-run CI and inspect the real workflow result before any Supabase deployment.
