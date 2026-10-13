# LOADIN Production Deployment Runbook

This runbook intentionally keeps all server secrets out of browser code.

## 1. Dedicated Supabase project
1. Create a dedicated LOADIN Supabase project.
2. Apply `supabase/migrations/001_...` through the latest migration in filename order.
3. Configure Phone OTP/SMS in Supabase Auth.
4. Set production Site URL / redirect allow-list.
5. Keep the service-role key only in trusted workers/server infrastructure.
6. Verify storage bucket/policies for private partner documents.

## 2. Browser public configuration
Generate deployment-time `/loadin-config.json` with `npm run config:write` using only `LOADIN_PUBLIC_*` environment variables.
Public values allowed:
- Supabase URL + anon key
- HTTP-referrer restricted Google Maps browser key
- Firebase Web config + public VAPID key
- Razorpay public key
- HTTPS payment API base
- HTTPS Admin/Fleet portal API base

Never expose a Supabase service-role key, Razorpay key secret/webhook secret, or Firebase service-account private key to the browser. CI includes a public-config secret regression guard.

## 3. Secure Admin/Fleet portal API
Deploy `services/portal-api/worker.mjs` or its Dockerfile.
- Uses Supabase URL + **public anon key**, not service-role.
- For every private request it forwards the signed-in user's bearer JWT to scoped Supabase RPCs.
- Admin role and city scope remain enforced inside database RPCs.
- Fleet ownership remains enforced inside `loadin_fleet_snapshot()`.
- Browser origin allow-list is exact; do not configure `*`.
- `GET /health` proves process liveness.
- `GET /ready` validates Supabase + production origin configuration.
- Supported app routes include `/dashboard`, `/fleet/me`, support resolution and city/service status control.

Set browser `adminApiBase` to this service URL. If omitted, current browser clients can still use the same scoped Supabase RPCs directly; production deployment should prefer the portal API when a separately managed API surface is required.

## 4. Payment worker
Deploy `services/payment-worker/worker.mjs` or its Dockerfile using values from its `.env.example`.
- `GET /health` proves the process is alive.
- `GET /ready` returns HTTP 200 only when Supabase, provider credentials, webhook secret and required browser-origin controls are configured.
- Razorpay webhook target: `/webhook/razorpay`.
- Customer online payment is not final until the signed provider webhook records `PAID`.
- Body size, JSON parsing and origin restrictions are covered by contract tests.

## 5. Notification worker / FCM
Deploy `services/notification-worker/worker.mjs` as a recurring Cloud Run Job/cron-style worker. A container definition is included.
Use service-account credentials. The worker creates and refreshes its Google OAuth access token automatically.
Run `node services/notification-worker/worker.mjs --check` during deployment to validate required environment variables without sending notifications.

## 6. Google Maps
Use a browser key restricted by production HTTP referrers and only the Maps APIs LOADIN needs. No unrestricted key should be shipped.

## 7. Cloud deployment blueprint
See `deploy/cloud-run/README.md` for container build/runtime layout for:
- Portal API
- Payment Worker
- Notification Worker job

Keep private values in Secret Manager or equivalent infrastructure secrets.

## 8. Final smoke
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
- Admin role login → live ops → booking detail → review → finance → safety/support
- Fleet role login → vehicle/driver → assignment → compliance → dispatch/report

## 9. Go-live gate
Use Admin → Production Readiness Center. Do not launch while configuration blockers remain. External credentials must be supplied and real OTP/payment/Maps/push flows must be tested in production before claiming them live.
