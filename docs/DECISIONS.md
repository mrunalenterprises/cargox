# CargoX Phase 1 — Decisions and launch gates

## Confirmed product scope
- Clean-slate project under Mrunal Technologies. Passenger services: Bike, Auto, Car, Outstation (One Way, Round Trip, Daily Car), Shared Car. Goods/logistics/parcel only in Phase 2.
- Local Book Now, Schedule, recurring Daily Services and fixed-pickup/drop Monthly Ride Packs; Office, College, Classes and custom trips. School/guardian support is designed but **disabled** until a separate approved operational/safety process.
- Pink Rider is an eligible woman-driver opt-in and customer preference, not a separate vehicle service. Driver picks Women Only or Women + Men. Pink Rider Only means no silent substitution. Full-party eligibility checked for women-only pooled trips.
- City-first service switches and licensing gate. Demo enables only Auto/Car in a fictional data/partner simulation of Chhatrapati Sambhajinagar. No public service activated.
- Working development UI style: mint primary #59BAA1, mint surface #B4DACF, accent #5AC0A5, action #0E885A, neutral #ECEDED, accessible complementary Pink. Glossy gradient cards with ~180–220ms feedback, no constant shimmer, reduced-motion support.
- Chosen creative Pink Rider tagline is documented in docs/BRAND_PINK_RIDER.md on main. "World's 1st" MUST NOT be a public claim until independently substantiated and legally reviewed.

## Technical decisions
- Node 22 **zero-dependency LOCAL DEMO** first for end-to-end functional testing without requiring secrets or network packages. Its API is in-memory and unauthenticated; deliberately binds to localhost. Never deploy it, tunnel it or use live identity/payment/location with it.
- Target production stack: Flutter Customer and Partner, Next.js Admin, Postgres/Supabase with RLS and server-only transactional APIs. CI begins with Node demo/domain tests. Install/compile Flutter and Next dependencies on a network-capable laptop.
- The production server, not client, must own rates/verification/OTP/seat and subscription concurrency. Current demo is not production backend.

## Unresolved; no silent assumptions
Legal approval and launch city, bike taxi licence/vehicle class, commercial pooling vs private carpool model, school transport/escort authorisations, fare/commission by jurisdiction, taxes/toll/routing, privacy and 24/7 incident response, real ID proof vendor, maps/geocoding, payment provider/settlement account, service availability, subscription policies including pause/refunds/holiday calendar. Build switches and demo stubs, not invented sign-off.
