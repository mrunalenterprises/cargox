# LOADIN Runtime Public Configuration

LOADIN browser apps now load deployment-time public configuration from `/loadin-config.json`. This avoids rebuilding every frontend screen when public project IDs or browser keys change.

## Generate the file

Use only public/browser-safe values:

```bash
LOADIN_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co \
LOADIN_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY \
LOADIN_PUBLIC_GOOGLE_MAPS_API_KEY=YOUR_RESTRICTED_BROWSER_MAPS_KEY \
LOADIN_PUBLIC_PAYMENT_PROVIDER=RAZORPAY \
LOADIN_PUBLIC_PAYMENT_KEY=rzp_live_PUBLIC_KEY \
LOADIN_PUBLIC_PAYMENT_API_BASE=https://payments.example.com/loadin \
LOADIN_PUBLIC_ADMIN_API_BASE=https://api.example.com/loadin \
LOADIN_PUBLIC_FIREBASE_API_KEY=YOUR_FIREBASE_WEB_API_KEY \
LOADIN_PUBLIC_FIREBASE_AUTH_DOMAIN=YOUR_PROJECT.firebaseapp.com \
LOADIN_PUBLIC_FIREBASE_PROJECT_ID=YOUR_PROJECT_ID \
LOADIN_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=YOUR_MESSAGING_SENDER_ID \
LOADIN_PUBLIC_FIREBASE_APP_ID=YOUR_FIREBASE_APP_ID \
LOADIN_PUBLIC_FIREBASE_VAPID_KEY=YOUR_PUBLIC_WEB_PUSH_VAPID_KEY \
npm run config:write
```

The generated `loadin-config.json` is intentionally ignored by Git so environment-specific values are not accidentally committed.

## Never put these in `loadin-config.json`

- Supabase service-role key
- Razorpay key secret
- Razorpay webhook secret
- Firebase service-account JSON/private key
- Any server signing key or database password

Those values belong only in trusted server/worker environment variables.

## Loading rules

1. Browser modules try `/loadin-config.json` with `cache: no-store`.
2. A pre-existing `window.__LOADIN_CONFIG__` can override hosted fields when a platform injects config at runtime.
3. Missing/invalid hosted config falls back to DEMO mode instead of inventing live credentials.
4. Auth, booking data, partner/admin RPCs, Maps, payments, notifications, push, and Production Readiness share the same runtime config source.

## Production checks

After deployment:

```bash
LOADIN_APP_BASE=https://YOUR_LOADIN_APP npm run smoke:production
```

Then open Admin → Production Readiness and confirm the required external integrations are READY.
