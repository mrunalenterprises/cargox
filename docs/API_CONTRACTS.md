# Local demo API contracts

These contracts describe the current in-memory, unauthenticated demo only. The server binds to 127.0.0.1. Do not deploy it or send it real identity, child, financial or location information. Production requires separately authenticated and transactional endpoints.

## Origins and adapters

- Default server: `http://127.0.0.1:4173`; override with `PORT` for an isolated fixture process.
- Current development session: preserved older process on 4173, updated process on 4174.
- Flutter `CARGOX_DEMO_API`: only HTTP origins on 127.0.0.1, localhost or Android emulator host 10.0.2.2. Requests must stay under `/api/` on the same origin. Android can use `adb reverse` to keep loopback binding.
- Admin server-side `CARGOX_DEMO_API`: only 127.0.0.1 or localhost HTTP origins. No public proxy. Timeout 2.5 seconds; Flutter request deadline 10 seconds.
- Responses: JSON, no-store. Domain validation errors use HTTP 400 with `{error, message}`. Unknown endpoints use 404. No automatic retry of booking mutations.

## Read operations

| Method / path | Result and limits |
| --- | --- |
| GET /api/health | `mode: local-only-demo`, `readyForProduction: false` |
| GET /api/catalog | Demo city, per-service switches and supported booking mode names |
| GET /api/demo/partners | Fictional seeded partners, never real verification evidence |
| GET /api/rides | Local public ride summaries; all fixtures visible, no account isolation |
| GET /api/offers?partnerId=... | Eligible REQUESTED rides for that seeded partner |
| GET /api/demo/customer-code?rideId=... | Assigned ride's short-lived demo start code; deliberately unsafe without auth outside loopback |
| GET /api/plans | Saved DEMO_UNPAID drafts and their distinct calendar legs |
| GET /api/admin | Local cities, partners, rides, drafts, audit events/count and illustrative pricing |

Public ride/admin responses exclude code, hash, salt and attempt count. Admin pages do not provide mutation APIs or real role-restricted information.

## Quotes and booking

`POST /api/quotes`: `{cityId?, service, distanceKm}`. Server checks service availability, validates finite 0 < km <= 500 and returns an INR/paise fare snapshot, included commission allocation and explicit illustrative pricing note. Client fare inputs are ignored.

`POST /api/rides`: `{cityId?, service, pickup, drop, distanceKm, mode?, scheduledAt?, pinkOnly?, allPassengersWomenVerified?}`. `mode` defaults to `now`. Non-immediate modes require `YYYY-MM-DDTHH:mm` with a valid calendar date. Civil scheduling uses the demo city's Asia/Kolkata convention, not the phone's UTC conversion. The demo does not run a persistent scheduler or promise dispatch at that time.

Pink Rider Only requires the fictional eligible-passenger fixture. Partner matching must find an approved, online, document-valid, identity-verified, service/city-eligible partner; Pink requests additionally require verified-woman and opt-in flags. The woman-only fixture requires full-party eligibility. Child transport is rejected. Bike, Shared Car and Outstation remain disabled in the configured city.

## Ride transitions

| Mutation | Required body | Server transition / rejection |
| --- | --- | --- |
| POST /api/rides/:id/accept | partnerId | REQUESTED -> ASSIGNED; rechecks city and eligibility, rejects already accepted rides and partners with any active assignment |
| POST /api/rides/:id/start | partnerId, code | ASSIGNED -> IN_PROGRESS only after owner, city, eligibility, 10-minute code expiry, attempt limit and code checks |
| POST /api/rides/:id/finish | partnerId | IN_PROGRESS -> COMPLETED only for assigned partner |

Start code: 4 decimal digits, up to five validation attempts, one-use on successful start. The local customer-code endpoint exists only for this unauthenticated harness. Completion does not create payment, settlement, refund or a paid receipt. A partner's demo overlap guard blocks every simultaneous active assignment; it is not a production time-window reservation algorithm.

## Daily / monthly drafts

`POST /api/plans/quote`: `{service, pickup, drop, distanceKm, startDate, endDate, weekdays, pickupTime, returnTime?, pinkOnly?, allPassengersWomenVerified?}`. Weekdays use 1=Monday through 7=Sunday. Maximum range is 63 civil dates; at most 124 legs. A return has its own time and leg entry. Output includes `legs`, `perLegQuote`, `totalPaise` and `requiresConsentBeforePurchase: true`.

`POST /api/plans/demo`: same payload with optional `preferredPartnerId`. Saves a `DEMO_UNPAID` draft with fixed stops and Pink preference. It does not generate bookings, assign partners or sell entitlements. Preferred partners are never guaranteed. Calendar entries have no OTP until a real ride leg is separately created and accepted.

Production blockers: approved capacity/stops rules, holidays/pauses, no-show and refund policy, persistent jobs, atomic entitlements, route re-quote, per-leg accounting, qualified replacements preserving Pink preference, verified payments and explicit-consent renewal. No unsupported operation is simulated as successful.

## Verification

Node API/domain tests use isolated ephemeral servers. `packages/cargox_demo/tool/smoke.dart` exercises the actual Dart HTTP adapter against a running isolated loopback API. Flutter widget tests inject controlled API fixtures. Android integration tests exercise each app against the isolated API; see BUILD_PROGRESS for actual execution results, not just source availability.
