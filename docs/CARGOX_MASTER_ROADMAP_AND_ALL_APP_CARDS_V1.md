# CargoX Master Blueprint V1 — Final Card Inventory, Screen Flows and Roadmap
Prepared 2026-09-28 for Customer Mobile, Partner Mobile and Admin Web.
**Status: product implementation baseline, not launch/licensing approval.** New codebase only; do not import old CargoX code, secrets, databases or migrations. `docs/PHASE1_SCOPE.md` remains binding for core safety and nonnegotiable phase boundaries.

## 0. Product rules shared by all three apps
**Phase 1 services:** BIKE, AUTO, CITY_CAR, OUTSTATION_CAR, SHARED_CAR.
**Cross-service options:** BOOK_NOW (where feasible), SCHEDULE_ONCE, RECURRING_DAILY / selected weekdays, MONTHLY_FIXED_ROUTE_PACK (where vehicle/route feasible). PINK_RIDER is a verified eligibility/preference *filter*, not another vehicle type. Do not expose a service/bookable mode where its city-specific licensing, partner capacity, safety and product implementation gates are not met. Show COMING_SOON/UNAVAILABLE honestly.
**Phase 2 only:** goods, mini truck, large/heavy vehicle, cargo, bike parcel, courier/logistics. Isolate extension points; do not write Phase 2 production UI/services yet.
**Primary operational unit:** City. Per-city independent switches for each service and eligible booking modes, partner eligibility, route, Pink Rider matching, plan selling and emergency-response readiness.
**Architecture:** new Flutter apps/customer and apps/partner; Next.js TypeScript apps/admin; backend proposal new Supabase Auth/Postgres/PostGIS/RLS/Realtime + audited secure server APIs/functions; map/provider abstraction. Don't provision paid services without approval. Sensitive booking, prices, eligibility, RLS, schedule, OTP, seat inventory, refund and money ledger MUST be server-side.

## 1. Customer mobile — navigation and card-by-card options
Bottom navigation proposed: **Home | My Rides | Daily & Packs | Wallet/Payments | Profile**; floating/contextual **Safety/SOS** during rides. Localizations: Marathi, Hindi and English; Roman language search support proposed.

### C00 Splash/first launch
Brand/language selector, location-permission rationale, notification-permission rationale, terms/privacy consent, next/login.

### C01 Authentication
Mobile number, OTP send/retry rate-limit, verification, profile name, optional email, preferred language, emergency contacts (optional but prompted), account help. Verified phone creates customer without staff approval. Never promise live tracking if permission is denied.

### C02 Home (PRIMARY CARDS)
Top: city picker (approved active city), current location/manual location, Saved Places, notifications, support.
- **Bike Ride card:** Pickup, Drop, route map, estimated fare, ETA, Pink Rider Only / Any Eligible where available and appropriate, Book Now, Schedule, Daily if city permits, offers and confirmation.
- **Auto Rickshaw card:** Pickup/Drop; passenger count, estimated fare/ETA, Standard or permitted alternate quote, Pink option when available, Book Now/Schedule/Daily, confirm.
- **Car Ride card:** Pickup/Drop; Mini/Sedan/SUV and luggage/passenger suitability, visible ETA and fare, Standard/eligible Self Rate, Pink when available, Book Now/Schedule/Daily/Monthly Pack, confirm.
- **Outstation Car card:** top tabs ONE WAY | ROUND TRIP | DAILY CAR, pickup city and exact pickup, destination city/drop, vehicle class, travel date, departure/return times, passengers/luggage, route fare/toll/waiting allowance, choose & confirm. Daily Car creates repeat/Monthly Pack along fixed intercity route, selected operating weekdays and per-leg daily time.
- **Shared Car card:** Find Ride (origin/destination/date/time/seat count/preferences), seat fare + driver/vehicle details + pickup point, live seat layout with SELECT and CONFIRM, booking history and safety. Woman user may choose Women Only journeys when inventory/verified eligibility allows. Do not mix lawful licensed pooling with private expense-sharing without separate legal configuration.
- **Daily Services LARGE CARD (separate from Outstation):** Office | School | College | Classes/Tuition | Other | Outstation Daily. For eligible types choose Schedule Once | Daily / selected weekday recurring | Monthly Fixed Route Pack; separate same-route pickup/drop + return pickup time, plan price and calendar.
- **Pink Rider info/filter card:** benefits and limitations, verified matching rules, availability by current city and selected service; must not imply guaranteed woman driver.
- **My Monthly Packs shortcut:** Active | Upcoming | Expired | Buy New.
Secondary shortcuts: Saved Places, Family Booking, Scheduled Rides, Support.

### C03 Location/pickup and destination card
GPS/use manual; current pickup and map pin; saved Home/Work/School/Other; stop restrictions; route preview, fare/ETA before purchase; if fixed-plan stop changes beyond allowed tolerance, show new quote and explicit approval.

### C04 Booking mode selector / Fare comparison
Tabs **NOW | SCHEDULE | DAILY | MONTHLY PACK** depending service. Show estimated / quoted fare and currency, distance/time, toll/parking, waiting and other taxes/fees, platform fee/discount where allowed, final payable amount, pickup ETA / scheduled commitment status, refund/cancel terms before Confirm. Standard or Self Rate only when enabled in legal city; NEVER arbitrary uncapped price changes absent local approval. Promo code, payment method and quote expiry.

### C05 Schedule Once details
Choose pickup date/time (future min/max rules), route, eligible class/service, outbound leg, optional return leg/return date/time (for eligible modes); quote, driver assignment pending disclosure, reminder preferences, payment, Confirm.

### C06 Daily Services purpose cards
- Office: office/home saved locations, commuting direction(s), workweek or custom weekdays, shift start/end, pickup and return times, start/end date, partner preference, estimated full plan cost, corporate billing LATER.
- School: guardian account + verified consent, school/pickup/drop and authorised handover contacts, child passenger eligibility, school days/time and safe handover workflow. **Disabled for public child-only booking until licensed school/child safeguarding and operating team signoff.** Avoid storing child data in free-form notes or showing third-party child locations.
- College: age-appropriate passenger and consent, college route, one/two-way, operating dates/times.
- Classes/Tuition: custom weekdays and evening schedules, authorised guardian controls if minor, pickup+return separately.
- Other: generic recurring fixed route (shops, clinic etc.) with same route/time validation.
- Outstation Daily: fixed intercity route, weekdays/holiday exclusions, One Way / Daily Return and monthly pack.
Purpose labels don't alter fare/service eligibility; booking must still select a vehicle class and legally enabled mode.

### C07 Monthly Pack builder and checkout
Purpose + vehicle class; **same fixed pickup/drop**, One Way or TWO WAY, outbound and return time, selected weekdays, plan start date, validity period, ride/leg count, excluded holidays, eligible eligible partner preference Same Partner Preferred or Any Approved Partner (no guarantee); transparent full-price and per-leg detail; permitted pause/skip/no-show/refund windows; explicit consent to terms and separate renewal consent, payment and receipt. Split outbound/return into **separate occurrence bookings** with separate partner, OTP, tracking and completion. If driver becomes ineligible/unavailable, offer allowed replacement; if Pink Only preserve preference, do not silently substitute.

### C08 Shared Car seat picker (single ride)
Route/driver and pickup point, vehicle outline and seat legend:
- **Green AVAILABLE** (selectable);
- **Orange SELECTED** (this customer's selected seat);
- **Red BOOKED** (unavailable);
- **Grey BLOCKED / driver seat**;
- **Pink WOMEN-ONLY RESERVED** (only for trips where verified permitted gender criteria apply; otherwise neutral).
Always include text status/icons (not color-only). Limited-lifetime transactional hold on selection; payment confirm converts hold to booked; expired holds release automatically; user can't seat-hop after finalisation without approved change. Validate passenger party and Pink/Women Only eligibility at hold and confirm. Show per-seat total, full breakdown, policies and availability count.

### C09 Matching / Driver on way
Matching progress, quote/pickup summary, driver name/photo/verified badge, vehicle plate/model, ETA, map, contact/masked call, change pickup within rules, cancel and fee disclosure, secure Share Ride, SOS. Pink Only incompatible replacement must return customer to explicit choice instead of auto fallback.

### C10 Pickup / Trip start
Driver Arrived; **unique 4-digit code** generated per occurrence, customer sees it; partner enters and server verifies before START/IN_PROGRESS. Each return trip gets a DIFFERENT 4-digit code. Driver or customer can raise pickup issue/no-show safety report.

### C11 Live Ride
Route, ETA, distance/time, privacy-limited tracking share (expiring signed URL), call/message support, SOS and incident reporting. Route deviations/long stops are advanced proposed detection; handle false positives and staffed escalation before enabling.

### C12 Completion/Payments
Exact final fare vs quoted fare breakdown and reasoned variation, UPI/cash where allowed, receipts, split payout/commission internally, feedback, tip optional city policy, issue fare dispute/forgot item/safety incident.

### C13 My Rides tabs
Now | Scheduled | Daily Calendar | Monthly Packs | History; each item expands date/time, trip leg, booking status, assigned/pending partner, directions, refund/cancel, track, OTP only when relevant, receipt, reorder route.

### C14 Wallet & Payments
Payment methods/UPI, transactions, coupons/offers, invoices, refunds status, plan payment receipts; optional stored wallet only after regulatory/compliance review.

### C15 Profile & Support
My profile, language, emergency contacts, saved routes, family bookings & guardian controls (only when approved), notification preferences, privacy/consent and delete-data flow, report problem, help, logout.

## 2. Partner Mobile — navigation and card-by-card options
Bottom navigation proposed **Home | Offers | Schedule | Earnings | Account**. Partner is DRIVER/OWNER/FLEET/AGENCY (each role scoped). Account creation alone doesn't confer booking eligibility.

### P00 Onboarding & approval
Language/phone OTP; choose Individual Rider/Driver | Vehicle Owner | Fleet Owner | Company/Agency; minimal profile; verified registration photograph; government KYC and mandatory police verification, permit/insurance/fitness/licence/vehicle records as required, cancelled cheque/passbook bank proof; vehicle(s), operating city, allowed services and routes, Pink opt-in where applicable; staff verification then Admin final approval. Explain missing/rejected documents and resubmission. Additional legal/operational checks for school/class/child work, outstation and shared car.

### P01 Home
Approval banner; availability ON/OFF, location and selected operating city, **fresh selfie on each GO ONLINE**, match vs verified registration photo and manual review if uncertain; Today's Rides, Upcoming Daily Trips, New Offers, Gross Earnings, Commission, Net Earnings, Alerts, SOS and Help. Never go online when docs expired, city/service off, selfie mismatch, or suspended.

### P02 Available Services (CARDS)
- Bike: eligible bike and bike-ride toggles, live booking offers, schedule availability.
- Auto: eligible vehicle and auto offers, schedule/daily shift availability.
- Car: approved class(es), ride offers, daily schedules and monthly commitments.
- Outstation: eligible intercity routes, One Way, Round Trip, Daily Car availability, overnight/return capability disclosures.
- Shared Car: approved route publish/request (where business model cleared), seat count, approved pickup points, trip date/time, women-only eligibility option, seat sales, passenger manifest with privacy controls.
- Pink Rider: opt-in verified woman driver; independently chooses Women Only or Women + Men; choose eligible services, available hours and verification status. Never use forced opt-in.
- Daily Service Commitment: Office | eligible School | College | Classes | Other | Outstation; routes, weekdays, capacity, pickup/return shifts, accept/decline series, reminders and replacement requests.

### P03 Live offers
New offer with pickup/drop, estimated distance/time, service type, passenger count, route and gross fare/charges, cancellation terms, customer rating subject to fairness/privacy policy; Accept/Decline within window, navigation. Server atomic offer claim, overlapping/late acceptance blocked; don't reveal unnecessary user profile data before acceptance.

### P04 Schedule & Monthly work
Calendar tabs Today | Upcoming | Recurring | Outstation; each leg as independent ride occurrence; series commitment, same-partner preference assignments, holiday exclusions, route/shift conflicts, driver approved replacement notice; child cases require verified authorised pickup/handover procedure.

### P05 Pre-trip and In-trip
Navigate to pickup, Arrived (timestamp), enter customer 4-digit trip code, server start verification, route navigation, waiting fee only by disclosed policy, complete drop with receipt; separate return pickup and new code. Contact support, masked call, share own SOS; exceptions no-show, breakdown, route blocked, accident and handover unresolved; incident workflow must prevent fraudulent completion.

### P06 Earnings & Pricing
Today | 7 Days | 30 Days | Month; Total Trips, Gross Fare, permitted toll/parking, platform commission, refunds/adjustments, Net Payable, payouts, disputes/download statements; Standard vs eligible Self Rate under **city legal and admin gates**; weekly Monday-only self-rate change if enabled server-side, no unreviewed price bypass. Proposed platform commission default 25% pending approval/regulatory review; no hardcoded final rate.

### P07 Vehicles & Documents
My Vehicles list, add/update vehicle & owner identity, service eligibility, document upload/status/expiry, bank details & masked evidence, KYC renewal, police verification, emergency contacts; owner/fleet view of only authorised drivers and vehicles.

### P08 Partner Support & Account
Safety SOS, trip complaints, request replacement/unavailability, training/help, settings, language, notifications, admin-configurable offer sound (subject to platform notification policy), logout/deactivate.

## 3. Admin Web — menus, dashboards and card-by-card controls
Roles: SUPER_ADMIN / ADMIN, CITY_GM, ACCOUNTS, FIELD_OFFICER, SAFETY_OPERATOR if staffed. RBAC least privilege, city assignment enforced server-side; sensitive payout and override require authorisation and audit.

### A01 Sign in and global Dashboard
Staff secure sign-in (MFA proposed for sensitive roles). City selector and per-city read/write isolation, Date filter Today | 7D | 30D | Custom.
Dashboard stat cards: Active Cities, Bookings Today, Live Trips, Upcoming Daily Legs, Active Monthly Packs, Pending Partner Approvals, Active Drivers, Gross Booking Value, Net Revenue, Pending Payouts, Refunds, Safety Alerts; filter by city/service, daily vs ad hoc, date and partner.
Charts/tables: funnel search->quote->booking->complete, cancellation/no-show, Peak Demand map (aggregate/privacy threshold), revenue by vehicle and booking mode, monthly-pack utilisation and unassigned upcoming commitments.

### A02 City Master
Create/edit city and operational boundary, status Active/Coming Soon, licensing verification, supported services/modes, service hours, geofences/coverage, per-service vehicle class, Pink availability, support readiness, route master, tariff/tax configuration. Toggle cannot override missing legal approval; show blocked reason.

### A03 Service & Vehicle Master
Bike, Auto, Car (Mini/Sedan/SUV), Outstation (One Way/Round/Daily), Shared Car, Daily/Monthly eligibility per service, vehicle/document requirements, partner capacity and disabled/coming-soon flags. New vehicle class requires policy and tests.

### A04 Partner Verification and Operations
Pipeline New | Documents Pending | Staff Verified | Admin Approved | Rejected | Suspended; document review expiry and police check, fresh-selfie appeals, partner type, city/vehicle/service mapping, Pink qualification, bank verification, audit notes. GM/FO scoped verification; final approval restricted Admin. Driver availability and double-booking incidents.

### A05 Bookings and Live Dispatch
Now | Scheduled | Recurring | Outstation | Shared; search booking/person/vehicle within role; tracking/ETA, matching queue, rejection/error logs, cancellation reason, live ride status, unique OTP audit metadata (never expose plaintext except secure authorised troubleshooting), authorised reassignment rules, safety desk escalation and masked contact. Operations can see future plan legs and assignment pending windows.

### A06 Daily Services & Monthly Packs
Purpose-specific list Office | School | College | Classes | Other | Outstation Daily; pack catalog per city/service/route; plan validity, weekdays, operating calendar, one/two-way legs, quote/tax/toll snapshot, estimated partner capacity, same-partner preference and Pink constraints; active subscriptions, pending/failed leg assignments, skip/pause/no-show/replacement and refund logs. Child travel category defaults NOT_LAUNCHED until guardian/handover/permit readiness individually signed off.

### A07 Outstation & Shared Route Desk
Route master, permit readiness, one-way/round/daily schedules, fare/time/toll/parking rules, planned driver rest compliance; shared-car lawful business-model gate, route stops, seat inventory/holds, occupancy/per-seat fare, Women Only journey eligibility and passenger privacy.

### A08 Pricing, Fees, Commission & Offers
Tariffs by city/service/time/vehicle/mode, transparent per-km/per-minute/waiting/toll/parking and outstation components, standard vs legally permitted self-rate, weekly rate-change audit, discount/promo budget, commission versioning (25% proposal, configurable only after review), partner payout display and quote/version history. Pricing changes never silently reprice sold monthly packs.

### A09 Accounts, Refunds & Settlements
Collections reconciliation, failed payments, refund workflow, statutory invoices where applicable, pending vs completed settlements, partner payout inquiries, authorised Admin final payout approval, ledger exports, audit and reconciliation exceptions. Optional wallet only if separate approvals and appropriate licensing met.

### A10 Safety & Incident Desk
Active SOS queue, customer/partner incident details with minimum location, trained responder assignments and escalation SLA, no fake 24/7 promise, signed-link revocation, route deviations (only after tested), document/suspension action and legally compliant evidence handling. Child pickup/handover exceptions isolated with restricted access and approved guardian notification protocol.

### A11 Staff & Permissions
Admin/GM/Accounts/FO/Safety operator RBAC; assign cities/zones and reporting manager; onboarding/verification task assignment, daily workload and role-specific performance dashboard, scoped audit logs, no cross-city overexposure.

### A12 Analytics & Reports
Bookings and completed legs, unit economics by service, partner activity, cancellation/refund/dispute, Pink opt-in supply versus demand (privacy aggregate only), shared seat occupancy, recurring commitment fulfillment, subscription renewal, city KPI, exported role-limited monthly reports.

### A13 Settings & Content
App banners, offers, notification templates, approved partner booking alert audio, localization copy, policies and versions, service badges/Coming Soon, maps/payment/notification provider configuration references (secrets ONLY server vault), support hours/emergency contact, change log.

## 4. End-to-end state and exception design
- Customer book now: verified OTP -> pickup/drop/service/city -> route/quote -> Pink/vehicle eligibility -> confirm -> payment hold/terms -> match/atomic driver assignment -> arrived -> customer 4-digit OTP -> in progress -> complete -> settlement/receipt -> feedback.
- Schedule once: quote snapshot and terms -> scheduled occurrence -> availability reminders/assign pending -> same trip process; allow transparent cancel/change according to approved policy.
- Recurring/monthly: fixed route + weekday calendar + immutable accepted quote/terms -> server creates finite future occurrence schedule -> payment/commitment -> each leg independently assigned, OTP'd, tracked and accounted -> no silent non-Pink substitution -> plan utilization and refund/skip/no-show.
- Shared: approved route + seats -> text-labeled seat map -> atomic expiring hold -> payment/confirm -> booked red status -> pickup/OTP/trip; seat conflicts must resolve safely.
- Guardian: approved guardian/contacts and eligible vehicle/driver -> authorised handover verified at pickup and drop; if school/minor workflow not legally/operationally ready, show unavailable rather than accepting bookings.
- Service availability requires city ACTIVE, feature READY, legal clearance, acceptable vehicle/partner class, sufficient capacity and staffed escalation readiness.

## 5. Master UI principles
Original interface (do not copy Rapido/Ola/Uber proprietary artwork/screens). Primary palette proposed: dark forest green + off-white with limited pink highlight for Pink Rider; high contrast, large tap targets, one-thumb navigation, accessible icons and text, screen-reader status labels; seat map uses green available, orange selected, red booked, grey blocked and pink women-only RESERVED **when applicable** with non-color labels. Display status prominently and disclose pending assignment; GPS/manual fallback; localization before launch and offline recovery.

## 6. Roadmap (delivery milestones, not guaranteed calendar dates)
**S0 Foundation**: brand/design system, legal readiness checklist, Flutter Customer/Partner + Next.js Admin clean mono-repo, secure new backend proposal, packages/contracts, mocked setup, CI & test harness. Acceptance: apps boot, screen shells/cards navigate, all nonfunctional actions visibly Coming Soon.
**S1 Core domain/auth/city**: OTP flows (test environment), city master and service gates, partner/vehicle onboarding, roles/RLS and domain/API tests. Acceptance: unauthorised access blocked, disabled service cannot book.
**S2 Local ride MVP**: eligible Auto + Car Book Now and Schedule: location, fare quote, matching, driver onboarding, OTP start, live tracking, safety, completed booking/receipt. Acceptance: reproducible user->driver->admin test cycle and payment reconciliation in sandbox.
**S3 Daily + Monthly**: Office daily recurring and pack billing, 2-leg occurrences, alerts/replacements/refunds and Admin schedule desk. Acceptance: weekday/month packs correctly create legs and account for payment; no double-driver allocation; no Pink fallback.
**S4 Pink Rider**: verified preference eligibility and cross-app UI, full-party tests, no silent fallback, incident and privacy review. Acceptance: all required privacy/eligibility negative tests pass.
**S5 Outstation + Shared + gated expansion**: One Way/Round/Daily Car, then legally authorised Bike and Shared Car/seat UI; child school/class only once dedicated legal, guardian, partner and safety operations launch gate passed. Acceptance: each service independent ride lifecycle, costs and safety compliance.
**S6 Launch readiness**: real-device tests, coverage/safety drills, capacity load tests, cancellation/ledger/webhook replay tests, App Store/Play packaging, city-specific controlled pilot, incident ownership. Acceptance: signed release checklist per city/service. **Phase 2 transport/logistics only after Phase 1 is stable.**

## 7. Open policy decisions requiring business/legal sign-off
First pilot city and selected licensed vehicle types; exact tariff and local permitted commission; booking fee, cancellation/refund/skip/pause and auto-renewal terms; whether private carpool is legally supportable; approved maps and payment provider; staff operating hours and incident response; guardian and school requirements; holiday calendar and guaranteed versus preferred driver service levels. Keep configurable and mark not-final in UI where material.

## 8. Test coverage / release blockers
Real tests: city OFF or missing legal gate refuses booking; partner rejects invalid documents/selfie; Driver cannot have overlapping rides or duplicate offers; Pink Only and women-only full-party NEVER silently fall back; 4-digit trip start code rate-limited, short lived and single use; every return leg separate; weekday/holiday/month boundary correct; purchased quote immutability; expired seat hold releases and cannot overbook; payment/refund webhooks idempotent; guardian profile and location cross-user isolation; notifications/reassignment work on real devices; no fake supported payment or staffed SOS; no old credentials or test child PII.


## 9. LOCKED visual system and automatic Pink Rider theme (2026-09-28)
**Preserve the Customer and Partner visual colour combination already shown to the owner, without redesign.** The regular baseline uses deep forest green `#102F27`, white `#FFFFFF`, soft green accents and white content cards. Pink Rider mode uses rich pink `#A82965`, light pink `#FFF4F8` and white. Apply the same visual language to the appropriate Driver Partner UI as well as Customer UI; avoid copying competitors' visual assets.

### State-driven theme contract
| Event/state | Customer root app theme | Assigned Partner root app theme |
| --- | --- | --- |
| No Pink ride selected or active | REGULAR green | REGULAR green |
| Customer explicitly chooses Pink Rider and initiates its booking | PINK immediately, even while searching (label 'Finding eligible Pink Rider') | Unchanged unless dealing with an accepted Pink trip |
| Partner opts into Pink Rider availability but has no accepted Pink trip | n/a | REGULAR green with visible Pink availability badge, not an all-pink app |
| Eligible partner receives a Pink request | Customer remains PINK | Pink-styled offer card to distinguish request; root stays REGULAR until partner accepts |
| Eligible Pink ride accepted / rider en route / rider arrived / OTP / trip live | PINK until terminal booking state | PINK for the assigned partner's active Pink trip |
| Pink rider unavailable, customer exits/cancels, booking fails/expires | REGULAR once the Pink request is no longer active | REGULAR if no accepted Pink trip |
| Pink ride completed or cancelled by either side | REGULAR immediately after authoritative terminal state | REGULAR immediately after authoritative terminal state |
| App killed/reopened, reconnect or switching tabs with active Pink ride | Restore PINK from current authenticated server booking state | Restore PINK from assigned active Pink trip |

Do not confuse pink visual styling with verification or confirmed assignment. Explicit text must differentiate Pink REQUESTED, SEARCHING, ACCEPTED, DRIVER ARRIVED, ACTIVE, COMPLETE and NO DRIVER AVAILABLE. For a cancellation or no eligible driver, offer a **fresh informed choice**; Pink Only must never silently fall back to an unverified/non-Pink driver. In a multi-booking/fleet view, drive root app theme from the user's *current focused or ongoing personal booking* and use per-booking visual badges for all other simultaneous tasks. Do not make theme switches based solely on location changes, navigation events, cached preference, gender inference or Pink opt-in status.

Implement `AppThemeMode { regular, pinkRide }` with central theme tokens and state derived from the authoritative booking lifecycle and typed booking preference. Customer starts Pink at explicit Pink booking request; Partner starts root Pink only upon assignment/acceptance of an eligible Pink ride. Transition back on terminal booking state; render defaults safely offline and reconcile stale events on rejoin. If the app is launched while offline with last-known Pink active booking, show clearly marked offline/unverified last-known status without claiming a current assigned driver. Never store sensitive woman-driver proof in theming layer.

Other semantic colors must remain consistent across themes: **red SOS/emergency**, text-labeled Green Available/Orange Selected/Red Booked/Grey Blocked/Pink Women Only shared-seat states, and map/route indicators must meet accessibility contrast and work without color alone. White background/card hierarchy and buttons stay familiar; provide subtle accessible transition, no distracting full-screen animation during navigation or emergencies. Persist user language and regular visual preferences independently of per-ride theme.

### Theme regression acceptance tests
1. Default Customer and Partner app home renders original Green/White tokens.
2. Pink Only selection followed by booking request changes Customer full app theme Pink; status remains 'searching' until eligible driver assigned.
3. Partner merely turning on Pink availability **does not** turn the entire Partner app pink. Incoming Pink offer gets Pink card; accepted Pink offer changes Partner active app to Pink.
4. Accepted Pink ride, trip OTP, tracking and SOS preserve themed UI with legible emergency elements for both sides.
5. Complete, cancel, expire and no-driver-available result in Customer theme reset; completion/cancellation resets relevant Partner theme. Never silently assign normal driver.
6. App restart/reconnect rehydrates Pink only when verified authoritative booking state is still active, and does not flash obsolete Pink theme as new booking state settles.
7. Monthly and Daily Pink ride occurrences switch Pink only for the current chosen/requested/assigned Pink occurrence, not for the lifetime of the entire monthly package.
