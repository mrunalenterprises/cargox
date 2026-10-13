# LOADIN Production Web Security

The production host/CDN should add security headers to all browser surfaces. The exact host is deployment-specific; do not weaken these controls to make third-party SDKs easier to load.

Minimum policy:

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy`: allow only capabilities LOADIN actually uses. Location is required on partner tracking flows; camera may be required for identity/proof capture.
- `Strict-Transport-Security` on the final HTTPS domain.
- Content Security Policy that explicitly allows LOADIN origin plus required Google Maps, Razorpay and Firebase endpoints. Avoid `*` and avoid adding `unsafe-eval`.
- `/loadin-config.json`: `Cache-Control: no-store` (or equivalent zero-cache policy) so public deployment configuration can rotate safely.
- `/firebase-messaging-sw.js`: revalidate/no-cache so service-worker changes propagate.

The runtime config file may contain public browser identifiers only. Never place Supabase service-role/secret keys, Razorpay secret/webhook keys, Firebase service-account credentials, database passwords or signing secrets in browser assets.

After production hosting is configured, run:

```bash
LOADIN_APP_BASE=https://YOUR_LOADIN_DOMAIN npm run smoke:headers
```

The smoke validates CSP presence, HSTS for HTTPS, `nosniff`, referrer/permissions policy, safe runtime-config caching, and common secret markers.
