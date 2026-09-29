# PIP PIP Android QA — local debug builds only

Scope: Customer and Partner Flutter **debug** apps, loopback-only fictional API. This is not a production sign-off. The old technical `CARGOX_DEMO_API` identifier remains intentionally unchanged for compatibility; the visible brand is **PIP PIP**.

## Automated regression added

- Customer trip start code: after an assigned demo trip is refreshed, the displayed four-digit code must disappear when the app receives any non-resumed lifecycle event. Resuming does **not** silently redisplay it; customer explicitly refreshes again. A late API reply received while in the background must not reveal the code.
- Partner: numeric-only four-digit code entry, auto-correction and suggestions disabled; an entered/partly entered code must clear on the first inactive/background lifecycle event and stay blank when resumed. Existing server-side code checks, expiry and rate-limiting remain authoritative.
- Widget regressions live in `apps/customer/test/widget_test.dart` and `apps/partner/test/widget_test.dart`. These behaviors must not be characterized as production authentication.

## Host tests without an emulator

From PowerShell in `C:\Projects\CargoX`:

```powershell
git status
flutter --version
cd apps/customer
flutter pub get
flutter analyze
flutter test
cd ../partner
flutter pub get
flutter analyze
flutter test
```

Do not run root-level Flutter commands (the monorepo contains unrelated untracked directories).

## Device test (only when a stable authorized Android emulator/phone is available)

Avoid indiscriminate process kills, emulator resets, directory cleanup or changing an existing `4173` demo server. The current mobile debug API normally uses the isolated `4174` server, **not** the unauthenticated `3001` Admin preview. Restarting an in-memory demo loses only its fictional state, but save any state you intend to preserve first.

1. Check that the separate local API on `http://127.0.0.1:4174/api/health` is healthy; start the correct demo process using the project's existing documented setup if not. Do not start a second process on the same port.
2. Connect exactly one permitted device, run `adb devices -l` and verify the expected device state is `device`. If emulator-5554 disappears or hangs while booting, stop and log the host/emulator issue without assigning the failure to application assertions.
3. Run `adb reverse tcp:4174 tcp:4174` for the selected device and confirm the mapping with `adb reverse --list`. When multiple devices are connected use `adb -s <selected-serial> reverse tcp:4174 tcp:4174`.
4. Debug build **each** Flutter app using `--dart-define=CARGOX_DEMO_API=http://127.0.0.1:4174` and the Java loopback-temp workaround already documented in `docs/BUILD_PROGRESS.md` on affected Windows hosts. Install only your own debug packages; preserve other device apps and data.
5. Customer: choose demo identity, create a normal Auto ride and then a separate Pink Rider Only Car request with a fictional eligible-women party. Partner: switch between the seeded generic and Pink fixtures and verify only an eligible opted-in Pink partner sees the Pink offer. Do not test with real people, identities or travel data.
6. When assigned, refresh Customer for the four-digit code. Send Customer to background; code must disappear. Resume: code must remain hidden until explicit refresh. Re-display, then start typing the code in Partner, send Partner to background; incomplete input must be gone on resume.
7. Re-enter the code and start/complete the trip. Refresh Customer to verify receipt and no exposed code. Confirm Pink Rider Only never silently falls back. Repeat at least once with TalkBack/large text, as feasible.
8. Record app version/commit, device make/Android version, connectivity/port mapping, screenshots (redact anything non-fictional), log errors and pass/fail per scenario. Do not assert two-app simultaneous E2E passed merely because standalone widget tests or counterpart API simulations passed.

**Known blocker:** previous Windows emulator runs intermittently crashed/hung before assertion. A successful local debug APK build and widget suite are not proof of device-level lifecycle behavior.

## Browser visual QA scope is separate

The existing locally uncommitted original glossy SVG + responsive web/Admin candidate is preserved. Do not commit or modify it as part of Android code verification. Admin Browser Use was denied on the saved permission for `127.0.0.1:3001`; only authorized browser access or user-supplied screenshots can close that review. Android widget tests do not close Admin browser visual QA.
