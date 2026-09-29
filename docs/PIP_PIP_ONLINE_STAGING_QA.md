# PIP PIP — phone-based online staging smoke test

This is a controlled Android debug preview, not a production passenger service.
Build provenance: the branch-scoped GitHub Actions workflow `.github/workflows/android-debug.yml`.
Use the artifacts on the most recent **successful** workflow run, not an older APK.

## Installing without USB

1. Download the separately named Customer and Partner artifacts and extract each ZIP.
2. Compare each `app-debug.apk` to its accompanying `SHA256SUMS.txt`.
3. Send the APKs to an Android phone and install using the normal Android permission prompt.
4. The existing local-demo Auto/Car request buttons still require an explicit local development server and are fictional. Do not assume they create real rides.

## Real online connectivity check

With mobile data or ordinary Wi-Fi (no USB or laptop required):

1. Open either app. Tap **Check online pilot**.
2. Expect **Staging connection successful**. The isolated Mumbai Supabase endpoint provides a read-only public catalog, not a booking API.
3. As of initial setup the catalog should return **no approved services** because the pilot city and all services are disabled pending explicit legal/operational approval.
4. Disable data/Wi-Fi and refresh. Expect **Online pilot unavailable**, never a fabricated ride or an unsecured local-demo fallback.
5. Restore data/Wi-Fi and refresh to retest the real HTTPS connection.

If the online page says it was not configured, ensure the APK came from the most recent verified workflow that supplies `PIPPIP_STAGING_URL` and the **publishable** key (never a service-role key). Do not send account secrets in chat.

## Staging boundaries / release blockers

- Online pilot: **read-only city/service listing**, governed by Supabase RLS and a security-invoker view. Android validates standard HTTPS certificates.
- Local demo: fictional in-memory ride preview on loopback. No Internet booking by design.
- No phone numbers, identity documents, payment instruments, live driver GPS or personal rider data are collected by the online pilot page.
- Real OTP/customer consent requires a configured and tested SMS provider, anti-abuse challenge, token lifecycle and separate native login UI.
- Partner activation requires trusted document checks and independent staff/Admin reviews with MFA; never auto-approve a synthetic or public registration.
- Real dispatch, route/distance pricing, geolocation privacy, Pink Rider matching, cancellation/payment reconciliation, SOS handling and service-specific legal checks remain gated.
- Maintain separate service-off/legally-not-ready admin toggles. Never seed an enabled pilot service just to make the online screen show a row.
- The six SECURITY DEFINER function lints are intentional RPC access surfaces but still require hosted signed-in negative tests before activation. Private tables with RLS and zero public policies intentionally default-deny; do not add permissive policies just to clear a linter.

## Code separation

The tested mobile read-only HTTP adapter is `packages/cargox_staging`. The shared pilot screen is `packages/cargox_ui/lib/online_pilot.dart`. Neither makes requests to the insecure fictional local demo or a privileged database endpoint.
