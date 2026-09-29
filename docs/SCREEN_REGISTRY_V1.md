# CargoX V1 — Screen Registry and Interaction Contract
Working engineering blueprint. Exact brand artwork and final 3D GLBs pending design/model production and device test. No old app layouts copied.

## Common UI framework
- Supported languages: Marathi, Hindi, English; locale-sensitive messages, fonts and amounts; do not bake translated campaign text inside raster assets.
- Shared global states for every async card: Loading skeleton (from approved model silhouette only, not unrelated photos), Available, Unavailable, Coming Soon, Pending Approval, Restricted by City, Offline/Network Error, Permission Denied and Support.
- Global services keys: bike / auto / car / outstation / shared_car. Do not create a separate fake vehicle class for Pink Rider.
- Vehicle scene data source: `assets/3d/manifest.v1.json`. Cards use interactive or subtle approved 3D animations, tap reliably leads to matching service. Details get 360° rotate. Reduced motion and offline use same-model render. Booking is never blocked by GLB decoding.
- Never show Sponsored content on live map, SOS, trip-start OTP, payment confirmation, or guardian child journeys. Always label paid content as Sponsored or translated equivalent.

## Customer App — fixed screen IDs and actions
C00 Splash | version and consent checks -> C01.
C01 Language and permissions | Marathi/Hindi/English, notification and location disclosure -> C02.
C02 OTP account | mobile, OTP attempts/lockout, privacy consent -> C03.
C03 City and location | auto detect or manual search, service availability -> C04.
C04 HOME | header location/search + FIVE 3D primary cards `bike`, `auto`, `car`, `outstation`, `shared_car`; own `customer_home_promo_carousel` promotion; Daily Services, Monthly Packs, Pink Rider and Scheduled Rides entry tiles; **one** labelled `customer_home_sponsored_inline` after booking essentials; footer Home/Rides/Payments/Help/Profile. Never allow campaign card to look like actual vehicle booking.
C05 Route Search | pickup GPS/manual/map and destination, saved locations/valid stop radius -> C06.
C06 Category | actual available service and city status, choose proper 3D vehicle category and seats; mini/sedan/SUV detail 360 viewer, accessibility list alternative -> C07.
C07 Preference | Pink Rider Only/Any if eligible and gender/consent qualified, rider notes, accessible vehicle preferences where offered, payment preference -> C08.
C08 Mode | Now/Schedule/Recurring/Pack subject to vehicle+city; validate pickup and return schedule -> C09.
C09 Quote | fare itemisation, taxes, legally applicable commission/fees, cancellation terms and estimated vs fixed indication; explicit confirmation -> C10.
C10 Matching | availability status, cancel action + terms, retries/no driver, never silent Pink fallback -> C11.
C11 Driver Assigned | verified name/photo, actual registered vehicle identifier (NOT merely illustrative 3D asset), contact masking, ETA, tracking share, driver changed alerts -> C12.
C12 Arrived & OTP | unique per-leg 4 digits, prevent unauthorised ride start; safety and help always accessible -> C13.
C13 In Trip | live tracking, expiring share, customer SOS, route incidents, no ads -> C14.
C14 Complete | transparent final bill, receipt/payment and rating/dispute -> C15.
C15 Ride History | details/receipts/help and audit timeline.
C16 Daily Services | Office/School/College/Classes/Custom/Daily Intercity category cards -> C17.
C17 Daily Schedule Editor | fixed pickup/drop, vehicle eligible, date range, weekdays, pickup+optional independent return time, guardian profile only when approved -> C18.
C18 Recurring Quote & Pack | daily-pay vs monthly, included ride occurrences, excluded holidays, skip/refund terms, eligible driver/assignment pending -> C19.
C19 Daily Calendar | daily outbound/return legs, skip request per policy, assigned driver/exception and 4-digit OTP for each leg.
C20 Outstation | One Way/Round Trip/**Daily Car**, city-to-city, date, vehicle class, permit/toll itemisation, repeat option -> C09 or C17.
C21 Shared Seats | date/route/stop/seat search, per-seat rate, Women Only eligibility, remaining capacity snapshot, reserve atomically -> C09.
C22 Pink Rider | informational preference selection, actual verified driver constraints, availability and no-guarantee messaging -> eligible booking route.
C23 Monthly Packs | active/renewal/expired, route contract, usage/next trips, skip/refund requests, separate return leg.
C24 Payments | methods, invoices, refunds and consented mandates; never show unapproved auto-renewal.
C25 Help & Safety | emergency tools, SOS/help contacts, incident reporting, privacy and account options.
C26 Profile | identity/settings/saved addresses, language, notification controls, optional guardian if permitted.
C27 Promotions | own offers only, offer validity, clear T&Cs, route back to newly priced quote.
C28 Sponsored Landing | external-link warning/allowlist and click privacy consent where required; no disguised safety or fare changes.

## Partner / Owner Flutter — fixed screen IDs
P00 Language/OTP -> P01 Role Selection (Driver / Driver+Owner / Owner / Fleet/Agency) with single verified identity and role grants.
P02 Driver Core Profile | licence category/expiry, identity/police checks, photograph, operating city, bank verification -> P03.
P03 Vehicle Add | type/class, plate, year, seats, document uploads, intended services/routes, owner role approval, vehicle-photo evidence -> P04.
P04 Approval | staff check then final Admin sign-off, reject/appeal/renewal.
P05 Partner HOME | Ride Online toggle separate from Vacancy availability, required fresh selfie comparison, earnings, current/upcoming trip cards, safety shortcut.
P06 Offer Detail | service/route/fare allocation, rider preference compatibility, accept/reject/expiry; overlapping slot prevention.
P07 Navigation/Arrived | actual pickup/trip controls, route/time, safe communication.
P08 Verify Start OTP | rate-limited server action per occurrence; no start without verified result.
P09 In Trip | route and SOS always visible; offline resilience with safe reconciliation.
P10 Finish & Fare | completion, payment type/status, incident option and ledger.
P11 Earnings | daily/weekly/monthly, per-ride breakdown, commission/payout/refunds.
P12 My Vehicles (Owner) | view/edit/renew documents, active service eligibility, approved-driver link, availability, revenue.
P13 Add / Assign Driver | consented driver search/link, separate compliance and City approval.
P14 Daily Contracts | eligible offered recurring packs, confirmed outbound/return obligations, schedule/driver replacement.
P15 Pink Rider | verified optional opt-in, Women Only or Women+Men, matching preferences and privacy.
P16 VACANCY Driver | Find Jobs, filters, details, applications, interview, offer, opt-in visibility, reports.
P17 VACANCY Owner | Post Job, moderation, opt-in driver browse, shortlist, interview, hires; no raw KYC exposure.
P18 Support & Incidents | SOS, report bad experience, contact.
P19 Profile & Compliance | roles, status, licence/permit expiry, bank, logout/privacy.
P20 Fleet Dashboard | aggregate fleet/driver availability, contracts, payouts, vehicle-doc expiries, open vacancies.

## Admin Web — fixed areas and roles
A00 RBAC login/session / audit.
A01 Overview by city, operational/safety flags, trips/booking/partner KPIs.
A02 Cities/Legal Readiness, licence references, approval dates, service and route on/Coming Soon gates.
A03 Service & Vehicle Master, stable code IDs and 3D manifest asset linkage; content moderation, accessible fallback review.
A04 Partner/Owner/Driver Verification Queue, staff then final admin, appeal and expiry.
A05 Fleet and Driver-to-Vehicle assignments with legally valid service approvals.
A06 Dispatch + active trip safety console, incident actions and tamper-evident event log.
A07 Booking Search/History/Exception states, daily calendars and specific occurrence audit.
A08 Pricing & Commission: city/service/category/route/effective version, simulate validity, dual approval when configured, publish for future eligible quotes only.
A09 Monthly Pack Plans/Subscriptions, available capacity, holidays, skip/pause/refunds and route changes.
A10 Outstation and Shared Car services, route eligibility, seat inventory and legality gate.
A11 Pink Rider Policy/Eligibility, no access to unnecessary private verification evidence.
A12 Vacancy moderation, verified employer accounts, abuse reports, offers and assignment checks.
A13 Marketing & Sponsored Ads: promotions, banner slot template, paid campaign verification, creative review, city targeting, schedule, impressions/clicks/billing, kill switch.
A14 Payments/Payouts/Refunds/Tax/Commission and finance export with approval segregation.
A15 RBAC/Staff GM/FO/Accounts, teams and operating cities.
A16 Safety Desk, escalation, required response ownership, route alerts and evidence retention policy.
A17 Content/Localisation/Asset releases incl real 3D model manifest checksum + fallback pair, alt text and model licence.
A18 Operations/Audit/Change approvals and retention.

## Interaction and navigation acceptance
- C04 renders five 3D service classes (not stock photo illustration). C06 detail orbit, fallback identical-class render; 3D failures do NOT block C09 or C25.
- C04 contains separate CargoX-owned carousel and Sponsored-labelled paid space AFTER essential booking controls, privacy/performance limits as documented.
- C17/C18/C19 retain fixed route, date/weekday recurrence and separate return occurrence; C20 exposes Outstation Daily Car visibly.
- P05's Go Online and P16's Find a Job availability are separate toggles, no side effect.
- A08 rate changes only new accepted quotes/contract renewals; legally invalid configurations cannot publish.
- P12 and A05 require both owner and driver permission; Vacancy hiring does not auto-enable ride dispatch.
- All screens implement empty/retry/error/permission/unavailable states and localised copy.
