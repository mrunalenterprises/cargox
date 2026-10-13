# LOADIN Production Deployment Runbook

This runbook intentionally keeps all server secrets out of browser code.

## 1. Dedicated Supabase project
1. Create a dedicated LOADIN Supabase project.
2. Apply `supabase/migrations/001_...` through the latest migration in order.
3. Configure Phone OTP/SMS in Supabase Auth.
4. Set production Site URL / redirect allow-list.
5. Keep the service-role key only in trusted workers/server infrastructure.

## 2. Browser public configuration
Create deployment-time `window.__LOADIN_CONFIG__` using `apps/shared/config.example.js`.
Only public values belong there:
- Supabase URL + anon key
- HTTP-referrer restricted Google Maps browser key
- Firebase Web config + public VAPID key
- Razorpay public key
- HTTPS payment API base
- HTTPS admin API base (when deployed)

Never expose a Supabase service-role key, Razorpay key secret/webhook secret, or Firebase service-account private key to the browser.

## 3. Payment worker
Deploy `services/payment-worker/worker.mjs` with values from its `.env.example`.
- `GET /health` proves the process is alive.
- `GET /ready` returns HTTP 200 only when Supabase, provider credentials and webhook secret are all configured.
- Razorpay webhook target: `/webhook/razorpay`.
- Customer online payment is not final until the signed provider webhook records `PAID`.

## 4. Notification worker / FCM
Deploy `services/notification-worker/worker.mjs` as a recurring worker/cron.
Use service-account credentials. The worker creates and refreshes its Google OAuth access token automatically.
Run `node services/notification-worker/worker.mjs --check` during deployment to validate required environment variables without sending notifications.

## 5. Google Maps
Use a browser key restricted by production HTTP referrers and only the Maps APIs LOADIN needs. No unrestricted key should be shipped.

## 6. Final smoke
After deployment run:

```bash
LOADIN_APP_BASE=https://YOUR_APP_DOMAIN \
LOADIN_PAYMENT_API_BASE=https://YOUR_PAYMENT_API \
node scripts/production-smoke.mjs
```

Then complete manual end-to-end QA for:
- Customer OTP → booking → dispatch → tracking → payment → completion
- Partner OTP → approved onboarding → fresh selfie → online → accept → proof → completion → wallet/payout
- Admin role login → live ops → booking detail → review → finance → safety/support
- Fleet role login → vehicle/driver → assignment → compliance → dispatch/report

## 7. Go-live gate
Use Admin → Production Readiness Center. Do not launch while configuration blockers remain. External credentials must be supplied and real OTP/payment/Maps/push flows must be tested in production before claiming them live.
