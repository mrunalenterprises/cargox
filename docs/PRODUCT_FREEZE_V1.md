# CargoX — Approved Product Feature Freeze V1
Approved by product owner on 2026-09-28. This freezes **features and high-level journeys**, not unreleased implementation or numeric regulatory settings. New project from zero; do NOT reuse old CargoX source, databases or secrets.

## Approved scope
1. Passenger service cards: Bike, Auto Rickshaw, Car (Mini/Sedan/SUV), Outstation Car (One Way/Round Trip/Daily Intercity), Shared Car (per-seat). City/service-specific legal launch gates.
2. Booking: Book Now, Schedule Once, Daily/Recurring and Monthly Fixed-Route Packs, independent outbound and return ride occurrences.
3. Daily services: Office, School, College, Tuition/Classes, Custom and Daily Intercity; verified guardian safeguarding and legally permitted school vehicle operations required before child service goes live.
4. Pink Rider: eligible verified woman driver opt-in Women Only/Women + Men, woman passenger Pink Rider Only/Any Eligible Driver, **never silently fall back**; full shared-party matching.
5. Partner and Fleet: single verified identity with eligible Driver, Driver+Owner, Owner, Fleet/Agency roles; Add Vehicle, document compliance, driver linking, availability, service eligibility and earnings.
6. Vacancy: verified owner job posting and opt-in driver job search, apply, shortlist, interview, offer/hire; hiring never automatically grants ride or vehicle eligibility. No driver application fee in MVP.
7. Safety: staff verification then final admin approval; police/ID/licence/vehicle checks as applicable; fresh selfie comparison at go-online; unique server-verified 4-digit start code per ride; live expiring tracking share, customer/driver SOS and staffed incident process.
8. Admin control: cities, eligibility, service on/Coming Soon, route and vehicle permission, changeable legally valid base fare/per-km/per-minute/waiting/outstation rates and commission, packs, payout, refunds, accounts, GM/FO and safety. Immutable accepted quote and versioned policy snapshots; no universal hardcoded 25% commission.

## Previously requested additional V1 modules, included in architecture
9. **Promotions and monetised sponsored banner ads**: a central asset library, own promotional carousels and one clearly labelled customer-home paid advertisement placement after primary booking cards; future slots require review. Moderation, service/city targeting, scheduled campaigns, consent/privacy requirements, reporting, invoices, capped impressions, brand separation and a global kill switch. Never place advertising over maps while driving, SOS, ride start OTP, safety alerts, payment confirmation or critical booking actions.
10. **Real interactive 3D vehicle assets**, not photographic card art, on eligible vehicle/service cards and detailed vehicle views. Canonical GLB/glTF models, device-quality adaptive LOD and accessibility-compatible deterministic fallback renders generated **from the same approved 3D models** when live 3D cannot run. No asset should misrepresent the real booked vehicle/class. Full requirements and naming in docs/MASTER_ASSETS_AND_3D_V1.md and assets/3d/manifest.v1.json.

## Fixed architecture principles
- Distinct Customer Flutter, Partner Flutter (with role-based Fleet/Owner screens) and Admin Web, with one authoritative backend and modular domain.
- All rates, commissions, geographic availability, campaign placements, UI copy and localisation are admin-controlled/versioned **within applicable law and permissions**.
- Driver and owner identity verified separately from job status. Pink Rider Only availability must be truthful.
- All changes to a live contract/booking are versioned, consented when needed and audited.
- Do not copy competitor artwork, trademarks, screenshots or proprietary 3D mesh. Commercial model licences and any visible branding are approved before use.

## Not yet fixed
Technical stack/vendor final decision, actual service tariff and commission within local law, launch location, detailed refund and holiday rules, final commercial 3D mesh delivery/licensing, campaign prices and legal approvals/permits. These are prelaunch gates, not reasons to rewrite the core domain.

## Delivery order
Screen registry and interaction specs -> domain schema and permission policies -> 3D asset pipeline and design tokens -> Customer/Partner/Admin end-to-end pilot -> recurring/monthly/Pink/Vacancy/ads within reviewed release gates -> field validation.
