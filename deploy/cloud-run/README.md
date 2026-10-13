# LOADIN Google Cloud deployment blueprint

Target region: `asia-south1` where available. Keep all private credentials in Secret Manager; never bake them into images or browser config.

## Images
Build from repository root so service Dockerfiles can copy their worker file:

```bash
gcloud builds submit --tag asia-south1-docker.pkg.dev/PROJECT_ID/loadin/portal-api -f services/portal-api/Dockerfile .
gcloud builds submit --tag asia-south1-docker.pkg.dev/PROJECT_ID/loadin/payment-worker -f services/payment-worker/Dockerfile .
gcloud builds submit --tag asia-south1-docker.pkg.dev/PROJECT_ID/loadin/notification-worker -f services/notification-worker/Dockerfile .
```

## Portal API — Cloud Run service
Public ingress is acceptable only with application-level origin + JWT checks enabled. It does not use the Supabase service-role key.

Required runtime values:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `LOADIN_ALLOWED_ORIGINS=https://YOUR_APP_DOMAIN,https://YOUR_ADMIN_DOMAIN`
- `LOADIN_REQUIRE_BROWSER_ORIGINS=true`
- `LOADIN_PORTAL_MAX_BODY_BYTES=32768`

Container port: `8790` (Cloud Run may inject `PORT`; set it to the platform-provided port if required by the deployment target).
Health/readiness: `/health`, `/ready`.

## Payment Worker — Cloud Run service
Required secrets/config:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PAYMENT_PROVIDER=RAZORPAY`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `LOADIN_ALLOWED_ORIGINS=https://YOUR_APP_DOMAIN`
- `LOADIN_REQUIRE_BROWSER_ORIGINS=true`

Container port: `8788` unless overridden by `PORT`.
Health/readiness: `/health`, `/ready`.
Webhook route: `/webhook/razorpay`.

## Notification Worker — Cloud Run Job / Scheduler
This process claims queued notifications, sends FCM messages, records delivery, refreshes document compliance, then exits. Deploy it as a Cloud Run Job and trigger it from Cloud Scheduler or another trusted scheduler.

Required secrets/config:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `FCM_PROJECT_ID`
- `FCM_CLIENT_EMAIL` + `FCM_PRIVATE_KEY`, or `FCM_SERVICE_ACCOUNT_JSON`
- `LOADIN_NOTIFICATION_BATCH`

Run `node worker.mjs --check` in deployment validation before scheduling the job.

## Browser runtime config
The web deployment must expose `/loadin-config.json` generated only from `LOADIN_PUBLIC_*` values. Set:
- `adminApiBase` to the deployed portal API URL.
- `paymentApiBase` to the deployed payment worker URL.
- Supabase URL/anon key, restricted Maps key, Firebase web config/VAPID key, Razorpay public key.

Never expose service-role, Razorpay secret/webhook secret, or Firebase private key in the browser.

## Release smoke
After all endpoints are live:

```bash
LOADIN_APP_BASE=https://YOUR_APP_DOMAIN \
LOADIN_PAYMENT_API_BASE=https://YOUR_PAYMENT_API \
LOADIN_ADMIN_API_BASE=https://YOUR_PORTAL_API \
node scripts/production-smoke.mjs
```

Then complete real-device Customer, Partner, Admin and Fleet E2E before go-live.
