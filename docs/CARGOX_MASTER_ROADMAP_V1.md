# CargoX — Clean-Start Master Roadmap v1.0
Date: 2026-09-28. Product requirements blueprint for review; not implemented code.
Old CargoX source/data is explicitly NOT reused.

## Modules
Customer Flutter, Partner Flutter (Individual Driver / Driver+Owner / Fleet Owner / Company Agency with role permissions), Admin Web (Super Admin/GM/FO/Accounts/Safety). Shared backend/domain and immutable audits.
Passenger services: Bike, Auto, Car (Mini/Sedan/SUV where permitted), Outstation Car (one-way/round-trip/daily intercity), Shared Car (per-seat). Pink Rider is an eligibility/preference overlay for qualifying services, never a promise of driver availability.
Booking modes: Now, Schedule Once, Repeat Selected Weekdays, Monthly Fixed-Route Pack (one-way or independently tracked outbound+return legs). Daily Service templates: Office, School, College, Tuition/Classes, Custom and Intercity. Home shows five primary vehicle cards, Daily Services, My Monthly Packs, Scheduled Rides and Pink Rider shortcut.

## Customer navigation and vehicle card rules
Splash/language -> OTP -> city + consent -> Home with pickup/destination/map, five vehicle cards, daily/services shortcut, Pink Rider shortcut, safety/help. Bottom tabs Home / My Rides (Now, Scheduled, Daily Calendar, Monthly Packs, History) / Payments / Help / Profile.
Bike: route, eligible bike category, estimate, Now/Schedule, Pink Rider where verified and lawful.
Auto: route, estimate, Now/Schedule, eligible Daily/Monthly.
Car: choose eligible Mini/Sedan/SUV, passengers, quote, Now/Schedule/Daily/Monthly, Pink preference.
Outstation: city-to-city, One Way/Round Trip/Daily Car, route dates/days, allowances/tolls, monthly intercity pack when service enabled.
Shared Car: search origins/destinations/stops, date/time, available seats, per-seat fare, confirmed stop radius, consented detour, eligible Women Only. Admin legally separates commercial licensed pooling from private cost-sharing.
Universal booking: location -> service/capacity -> schedule/preferences -> verified fare breakdown and cancellation terms -> confirm/payment authorization -> transactional driver matching -> driver identity/ETA -> OTP start -> tracked trip + safety -> end -> final payment/receipt/rating/dispute. No silent assignment to unavailable or unapproved drivers.

## Daily and monthly contracts
Recurring master: fixed source/destination (route tolerance policy), selected weekdays, date range, pickup time, optional return leg/time, eligible vehicle/service, rate snapshot, published holiday/skip/pause/refund policy, same-driver-preferred vs any eligible, Pink Rider Only no silent fallback. Generate each leg as distinct occurrence with unique server-verified one-time OTP. Driver/vehicle calendars block overlaps; subscription sale never falsely promises a specific driver.
School/tuition: extra safeguarded launch gate: verified parent/guardian consent, approved receiving adults, restricted data access, verified route and eligible school transport/escort requirements, exception and handover protocol; OFF until authorised.

## Partner / Owner onboarding and cards
Phone OTP -> choose role -> core identity -> document verification -> bank -> city -> driver qualifications (licence, police checks, language/experience etc) OR add vehicle.
Add Vehicle: choose category -> registration/brand/model/year/fuel/seats/city -> RC/insurance/PUC/fitness/route permit as applicable -> photos -> offered eligible services/routes -> owner verification -> optional opt-in assign verified driver -> staff + admin approval -> vehicle active if all documents current and legal operation gates ON.
Partner home: Go Online with fresh photo comparison; Ride Offers; Accepted/Upcoming/Daily Commitments; Navigation/OTP/Tracking; My Vehicles; Earnings/Payments; Vacancy; Safety/Support; Profile/Documents.
Owner Vehicle card: View Details, Edit, Documents/Renewal, Approved Service Toggles, Availability, Assigned Driver, Hire Driver/Vacancy, Earnings, Compliance/Alerts. One account can have driver and owner roles, separately authorised.
Vacancy feature: drivers browse/apply to verified owner vacancies; owners post moderated jobs, search opted-in and consenting verified driver profiles, shortlist, interviews, consented offers and hires. Hiring never automatically authorises passenger rides or transfers private licence/KYC documents. Separate job-seeker availability from ride online status. No driver application fee in MVP. Details in docs/DRIVER_JOBS_VACANCY.md.

## Admin navigation
Overview & cities, service/legal readiness gates, partner staff verification -> admin approval, vehicle documents/expiry, realtime dispatch/safety, Bookings & recurring contracts/ride occurrences, city rates/commissions/policies, Pink Rider and eligibility, shared seat routes, Fleet/Owner, Vacancy moderation, Payments/refunds/settlements, role-based staff (GM/FO/Accounts), incident desk and immutable audit. City filter across dashboards. Keep price/fee/commission parameters configurable; initial 25% commission is earlier *proposal*, not fixed without viability and local rule review. Self Rate allowed only where lawful with clear displayed offers, admin approval and server-enforced change schedule.

## Release gates and phases (in order)
0 Legal viability per city/service, vehicle permits, operating company/aggregator authorisations, payments, insurance, privacy and safety operating plan; architecture/UX.
1 Clean monorepo + CI + domain API contracts, DB migrations, auth/RBAC, city and identity verification.
2 Customer+Partner+Admin end-to-end Auto/Car pilot: now/schedule/quote/match/OTP/track/pay/incident/payout.
3 Recurring/daily office commute and monthly pack with full ledger, calendar, replacement, notifications/refunds.
4 Pink Rider and extra eligibility/privacy/safety validation; outstation including daily intercity.
5 Moderated Vacancy MVP, consented employer/driver linking and assignment checks.
6 Shared Car and Bike by independent legal approvals; school/tuition only after guardian/handover compliance.
7 Pilot one city with real staffed support, regulatory clearances, security tests, app store release.
8 Goods/transport/logistics is Phase 2 and is absent from Phase 1 executable code.

## Functional acceptance
- Disabled city/service cannot receive new bookings or advertise live availability.
- Expired driver/vehicle approval blocks matching and replacement.
- Driver cannot accept overlapping booking/recurrence; shared seat inventory locks atomically.
- Pink Rider Only preference never silently replaced, including month plans.
- Every outbound and return occurrence has its own short-lived rate-limited start OTP.
- Pay/refund webhooks idempotent; fare snapshot/ledger audited; no undocumented auto-renewal.
- Guardian cannot see another family's location/data; missed handover triggers intervention.
- Private driver KYC/phone not exposed through employer browse; opted-out driver invisible; job offer never auto-binds vehicle.
- Location sharing expires; SOS must have escalation owner and operational response testing.
- Original icons/UI/assets only; no competitor trademark/interface copying.

## Decisions to explicitly sign off
Initial licensed city and services; legal classification of pooling/private carpool/bike school routes; tech/maps/payment stack; operational safety desk; rate/surge/commission/driver settlements per city; monthly included trip vs day basis, holidays, delays/skip/pause/cancel/refund and outstation toll/driver allowance; driver hire employment terms; branding/design tokens. Freeze UX/workflow and data schemas after signoff, keep numeric policies in admin. This plan reduces rework but cannot guarantee no change with laws, operations or real-world user testing.


## APPROVED BUSINESS SETTING — Configurable per-km fares and commission (28 Sep 2026)
The owner confirms that CargoX will apply for **all legally required aggregator and service/vehicle permissions** before operating. This is an intention and launch gate, not a statement that permissions are already granted.

Pricing and platform commission are **Admin-managed**, configurable by country/state, licensing scheme, city/operating jurisdiction, vehicle/service category, route (including outstation), booking mode (Now/Schedule/Recurring/Monthly) and effective date. Do not hardcode a universal per-km price or default platform commission into client code, server, or contracts. Any prior 25% commission idea is an unapproved historic proposal and must **not** be silently shipped as the default.

**Admin Pricing Settings cards**:
- Legal Jurisdiction & License Model: approved authority, geographic scope, fare order reference, licence model (e.g. surge vs convenience-fee where applicable), required vehicle/driver permits; approved min/max fares, max platform share/fees and minimum driver share where specified. Attach authoritative rule reference, effective date and verified-by approver. Lock launch when required legal approval is missing, expired or unresolved.
- Base Fare / Minimum Trip Distance, Per-KM Rate, Per-Minute/Waiting, Outstation Base/Per-KM, Night/Peak modifiers, Toll/Parking/Tax itemisation; per-seat prices for Shared Car only under the authorised legal model. Only expose controls that are permitted by the selected state/authority/licence model. An authorised fare order overrides a proposed custom price.
- Commission Mode: legally permissible platform percentage/fixed convenience fee (if permitted), payout floor, fee payer and tax basis; platform commission is **distinct** from GST, toll/parking, payment fees, driver payouts and any regulated driver-welfare levy.
- Daily and Monthly Packs: route-specific rate, trips/days included, one-way vs two-leg, holiday exclusions, cancellation/no-show/refund rules and driver compensation. A rate change must not retroactively alter accepted ride or pack contracts.
- Deployment: Draft -> Simulate/Validate Against Compliance Profile -> Authorized Admin Approval -> Schedule Effective Time -> Publish. Editable only with pricing permission and (if assigned) second-person approval; maintain audit history, reason, rollback to a newly approved version and notification to affected parties.

**Backend pricing/dispatch contract**:
- Server computes final eligible quote from effective, versioned fare rule and route. Quote response displays total, fare components, applicable regulated limits, driver amount and platform share consistent with the applicable local rules.
- Client cannot submit or override fare/commission. Revalidate rate and legal service eligibility server-side before quote acceptance and driver offer; ensure no self-rate arrangement bypasses a mandated tariff/share.
- Immutable quoted/accepted version IDs persist on each trip, return leg and monthly-pack purchase; subsequent Admin edits affect only eligible future quotes/renewals, not already accepted commitments.
- Audit tests: rates outside mandatory bounds rejected, minimum driver share protected, city licence inactive blocks booking, unauthorised staff cannot publish, scheduled changes do not mutate existing pack amounts, every receipt shows lawful itemisation.

**Regulatory research**: MoRTH Motor Vehicle Aggregator Guidelines 2025 are framework guidance for State rules. Maharashtra's current operative aggregator regulations and RTA tariff/driver payout terms must be checked against the official latest gazette/orders with licensed transport counsel before configuring the production compliance profile; an October 2025 Maharashtra document is explicitly a *draft* and is not sufficient alone. Multi-state rollout uses independent jurisdiction profiles and authorisations.


## Product owner approval and 3D/marketing addendum — 2026-09-28
The product owner APPROVED the entire Phase 1 feature structure: passenger services, booking types, daily services, Pink Rider, partner/fleet, Vacancy, safety and Admin control, as documented in `docs/PRODUCT_FREEZE_V1.md`. This is a full new build and does not re-use old CargoX source or databases.
**Visual decision:** the illustrative Bike, Auto Rickshaw, Mini, Sedan and SUV cards should use interactive, real GLB/glTF **3D vehicle models instead of flat stock vehicle photos**, with same-model offline/reduced-motion fallback renders (not unrelated downloaded photos). Keep customer and staff identity/real vehicle compliance photographs where genuinely necessary. The inventory, LOD/memory targets, accessibility and licence approvals are fixed as **requirements**, but no final meshes have been delivered yet: `docs/MASTER_ASSETS_AND_3D_V1.md` and `assets/3d/manifest.v1.json`.
**Marketing monetisation requirement:** home-owned promotion carousel and separate labelled sponsored/paid ad slot AFTER primary booking cards. All creatives moderated and optional; never in emergency, checkout, active ride/OTP or child guardian flows. Campaign city/date targeting and billing are independent of sensitive passenger/driver or Pink Rider profile data.
**Next planning:** a unified screen registry, backend domain/entity schema and permission architecture must use stable service and 3D-asset IDs and approved promotional slot IDs.
