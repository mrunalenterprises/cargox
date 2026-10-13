# LOADIN Production Deployment Runbook

This runbook intentionally keeps all server secrets out of browser code.

## 1. Dedicated Supabase project
1. Create a dedicated LOADIN Supabase project.
2. Apply `supabase/migrations/001_...` through **053** in filename order.
3. Configure Phone OTP/SMS in Supabase Auth.
4. Set production Site URL / redirect allow-list.
5. Keep the service-role key only in trusted workers/server infrastructure.
6. Verify the private `partner-documents` bucket and storage policies.
7. Complete the first Super Admin Phone OTP sign-in once so the production Auth user exists.

## 2. One-time production bootstrap
After the first Super Admin Auth user exists, run the bootstrap only from trusted infrastructure:

```bash
SUPABASE_URL=https://YOUR_PROJECT.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY \
LOADIN_SUPER_ADMIN_USER_ID=THE_AUTH_USER_UUID \
LOADIN_SUPER_ADMIN_NAME="LOADIN Super Admin" \
node scripts/bootstrap-production.mjs --dry-run
```

Review the plan, then run again without `--dry-run`.

The bootstrap is idempotent and:
- grants/repairs the first `SUPER_ADMIN` membership through a service-role-only RPC,
- enables the launch city,
- creates all four fixed LOADIN service controls,
- defaults services to `COMING_SOON` so accidental bookings cannot begin before operations are ready.

Use `LOADIN_INITIAL_SERVICE_STATUS` only when deliberately changing that safe default. Additional GM, Accounts and Field Officer access is then managed from Admin → Staff & Audit and remains role/city scoped server-side.

## 3. Browser public configuration
Generate deployment-time `/loadin-config.json` with `npm run config:write` using only `LOADIN_PUBLIC_*` environment variables.
Public values allowed:
- Supabase URL + anon key
- HTTP-referrer restricted Google Maps browser key
- Firebase Web config + public VAPID key
- Razorpay public key
- HTTPS payment API base
- HTTPS Admin/Fleet portal API base

Never expose a Supabase service-role key, Razorpay key secret/webhook secret, or Firebase service-account private key to the browser. CI includes a public-config secret regression guard.

## 4. Secure Admin/Fleet portal API
Deploy `services/portal-api/worker.mjs` or its Dockerfile.
- Uses Supabase URL + **public anon key**, not service-role.
- For every private request it forwards the signed-in user's bearer JWT to scoped Supabase RPCs.
- Admin role and city scope remain enforced inside database RPCs.
- Fleet ownership remains enforced inside database RPCs.
- Browser origin allow-list is exact; do not configure `*`.
- `GET /health` proves process liveness.
- `GET /ready` validates Supabase + production origin configuration.

Supported application routes include:
- `/dashboard`
- `/fleet/me`
- support resolution
- city/service configuration + status
- city/service pricing
- Admin staff snapshot + staff access mutation
- finance reconciliation snapshot/run/resolution
- Fleet vehicle/driver/assignment/status mutations

Set browser `adminApiBase` to this service URL. If omitted, supported clients can fall back to the same authenticated scoped Supabase RPCs directly.

## 5. Payment worker
Deploy `services/payment-worker/worker.mjs` or its Dockerfile using values from its `.env.example`.
- `GET /health` proves the process is alive.
- `GET /ready` returns HTTP 200 only when Supabase, provider credentials, webhook secret and required browser-origin controls are configured.
- Razorpay webhook target: `/webhook/razorpay`.
- Customer online payment is not final until the signed provider webhook records `PAID`.
- Body size, JSON parsing, amount validation, idempotency and origin restrictions are covered by contract/security tests.

## 6. Notification worker / FCM
Deploy `services/notification-worker/worker.mjs` as a recurring Cloud Run Job/cron-style worker. A container definition is included.
Use service-account credentials. The worker creates and refreshes its Google OAuth access token automatically.
Run `node services/notification-worker/worker.mjs --check` during deployment to validate required environment variables without sending notifications.

## 7. Finance reconciliation worker
Deploy `services/reconciliation-worker/worker.mjs` as a trusted scheduled job.

It checks completed bookings against payments, settlements and balance events for:
- completed booking without settlement,
- online completion without enough confirmed PAID payment,
- settlement fare vs Fare Lock mismatch,
- Commission Partner amount not equal to 15%,
- Subscription Partner commission not equal to 0%,
- partner entitlement mismatch,
- missing Commission Balance debit event,
- missing online Earnings credit event.

Recommended schedule: **daily and immediately before payout/release windows**. Configure `LOADIN_RECONCILIATION_HOURS` from 1–744 hours. The worker exits with code `3` when P0 finance anomalies exist so monitoring can alert Operations.

Admin → Finance Reconciliation provides the same scoped on-demand run, issue review and audited Resolve/Ignore actions.

## 8. Google Maps
Use a browser key restricted by production HTTP referrers and only the Maps APIs LOADIN needs. No unrestricted key should be shipped.

## 9. Cloud deployment blueprint
See `deploy/cloud-run/README.md` for container build/runtime layout for:
- Portal API
- Payment Worker
- Notification Worker job
- Finance Reconciliation Worker job

Keep private values in Secret Manager or equivalent infrastructure secrets.

## 10. Final smoke
After deployment run:

```bash
LOADIN_APP_BASE=https://YOUR_APP_DOMAIN \
LOADIN_PAYMENT_API_BASE=https://YOUR_PAYMENT_API \
LOADIN_ADMIN_API_BASE=https://YOUR_PORTAL_API \
node scripts/production-smoke.mjs
```

Also run production web-header smoke against the deployed host:

```bash
LOADIN_APP_BASE=https://YOUR_APP_DOMAIN npm run smoke:headers
```

Then complete manual end-to-end QA for:
- Customer OTP → booking → dispatch → tracking → payment → completion
- Partner OTP → approved onboarding → fresh selfie → online → accept → proof → completion → wallet/payout
- Admin role login → live ops → booking detail → partner review → staff scope → finance/reconciliation → safety/support
- Fleet role login → vehicle/driver → assignment → compliance → dispatch/report

## 11. Go-live gate
Do not launch until all of the following are true:
- Admin → Production Readiness shows no configuration blockers.
- First Super Admin and required city staff are assigned and verified.
- Only deliberately enabled services are `ACTIVE`; unfinished services remain `COMING_SOON`/`PAUSED`.
- Real OTP, Razorpay, Maps and FCM flows pass on production devices/browsers.
- Payment webhook and settlement scenarios are reconciled.
- Latest finance reconciliation has **zero open P0 issues**.
- Payout workflow is tested from request → approve/process → paid/reject.
- Production smoke and security-header smoke pass.
- Customer, Partner, Admin and Fleet real-device E2E passes.

External credentials and real production transactions must be tested before claiming LOADIN live.
