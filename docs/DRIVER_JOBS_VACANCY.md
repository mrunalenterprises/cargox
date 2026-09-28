# CargoX Phase 1 — Driver Jobs / Vacancy Module
Status: product requirements baseline, 28 September 2026

This module is part of the **fresh clean-start CargoX passenger mobility build** alongside Bike, Auto, Car, Outstation, Shared Car, Pink Rider, Schedule/Daily and Monthly Ride Packs. Do not import any old code or databases.

## Goal
Two-way marketplace: (1) a driver finds jobs from verified car/vehicle owners, fleets or agencies; (2) an owner recruits an already onboarded, willing and qualified driver. Job search must work independently of the driver ride-acceptance Online/Offline status.

## Entry points
- Customer app: optional "Own a Vehicle? Hire a Driver" entry leads to role/owner onboarding only; no driver details leaked to general customers.
- Partner app: "Vacancy / Driver Jobs" main menu with **Find Jobs** for drivers and **Hire a Driver** for owners/fleets. One verified login can have permissioned multiple business capabilities without creating duplicate identity records.
- Admin web: Vacancies, employer verification, reports, spam/fraud moderation, jobs analytics and disputes. Each city has enable/Coming Soon controls.

## Driver profile
Explicit job-seeker opt-in and availability (not looking / open to offers / actively applying); desired city/service radius; eligible vehicle categories (Bike/Auto/Car/SUV etc.), valid licence class/endorsements and expiration; commercial experience; preferred schedule (full-time, part-time, daily, monthly, outstation, night), salary expectation; languages, optional resume and availability date. Show only consented contact details after accepted application or mutually accepted invite; no unnecessary ID/address exposure. Licences and police-verification data stay access-restricted; show status rather than private files.

## Verified vehicle owner / fleet vacancy fields
Owner/fleet identity approval; title, city/base, pickup/reporting location in coarse granularity before mutual acceptance, vehicle class, required valid licence, type of driving (local, office/school commute, outstation/daily), work schedule & days, salary range and pay frequency, employment vs contract arrangement, accommodation if relevant, leave/holiday policy, expected start date, number of openings, hiring contact, expiry, requirements and clear disallowed/unsafe content rules. Salary range or negotiable must be transparent; legal employment/contract checks before live use.

## Application and recruitment flow
Draft -> submitted -> auto content validation -> moderation/owner-verification -> PUBLISHED -> PAUSED/EXPIRED/FILLED/CLOSED. Only vetted employers can publish.
Driver: browse filters -> job detail -> apply with explicit consent -> application dashboard -> withdraw -> interview offer -> accept/reject -> selected/not selected -> mutually confirmed placement. Owners: post vacancy -> review consented applicants, search opted-in driver profiles filtered by skills/licence/city/availability -> send invitation -> shortlist -> invite interview -> offer -> selected/closed. Job posting does not silently enrol any driver. No automatic assignment of driver to owner's vehicle after placement: run separate partner-driver link consent, KYC/licence, insurance, vehicle, city and admin approval checks before live ride dispatch.

## Important privacy, anti-fraud and safety
- Block public contact harvesting; search results redact phone number, documents and precise home address.
- Role-level and city-level access, profile visibility consent, reporting/blocking, rate limits, spam detection, time-limited invites, audit log.
- Never sell or transfer driver's private KYC records to hiring owners.
- Separate job salary/contract and payments from CargoX per-ride fare, commission and payouts. Any recruitment fee requires explicit published policy and applicable legal review; do not silently charge job seekers.
- A driver working for an owner should not be offered two simultaneous scheduled ride obligations; recurring ride calendars reserve capacity and enforce driver/vehicle attachment terms.
- Retire stale vacancies; notify employer and applicants appropriately.
- School/child-transport jobs require extra eligibility and transport/safeguarding checks before activation.
- Allow Pink Rider opted-in women drivers to opt into suitable opportunities. Do not display sensitive identity documents and do not claim automatic safety assurances.

## Driver UI
Partner home -> Vacancy -> Find Jobs / My Applications / Invitations / My Job Profile; filters city, vehicle, schedule, pay; detailed application, interview and offer states. Ride online state remains separate.

## Owner UI
Partner home -> Vacancy -> Post Job / Search Available Drivers / Applicants / Interviews / My Hires; consented driver invitation and separate assign-to-vehicle approval. Allow individual owners, fleet owners and verified agencies; prevent duplicate spam vacancies.

## Admin UI
Admin -> Vacancy city dashboard -> employer KYC -> postings approval/moderation -> flagged applicants/owners -> job status/metrics -> complaints and audit -> driver-to-vehicle linking eligibility checks.

## Suggested domain entities
DriverJobProfile, HiringOrganization, Vacancy, VacancyRequirement, VacancyApplication, DriverInvitation, Interview, JobOffer, EmploymentLink, DriverVehicleAssignmentApproval, VacancyModerationEvent, ConsentRecord. Ownership and access policies mandatory. All timestamps and city/service IDs explicit.

## End-to-end acceptance checks
1. Opted-out driver profile never appears in employer search.
2. Driver's active ride dispatch eligibility does not require job-seeker availability and vice versa.
3. Expired licence or failed approvals prevent operational driver/vehicle linking even if owner offered employment.
4. Rejected/closed vacancy cannot accept new applications; employer can never scrape all driver phone numbers.
5. Owner cannot change offer terms silently after driver consent.
6. Driver can withdraw and revoke public job-search visibility without losing trip history or legitimate booking capability.
7. Interview and job application notifications are not treated as ride offers.
8. All placement/recruitment fees, if ever introduced, must be separately approved and disclosed.

## Clean implementation priority
Scaffold domain models + RLS/permissions alongside initial Partner/Owner role design now. Ship minimal verified owner postings, driver job search/apply and owner shortlisted responses after passenger booking core stability; advanced employer search, scheduling and contracts can follow without changing core architecture.
