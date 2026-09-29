# CargoX V1 — Logical Database and Security Schema
Engineering **design draft** after approved product freeze. No database has been created or migrated by this document. Start from a clean database and migration history. IDs are stable UUIDs; timestamps UTC with appropriate locale/timezone presentation; money uses minor units + currency + country. PostgreSQL/PostGIS is proposed but vendor/DDL await architecture signoff.

## 1. Core identity and geographic authorisation
`accounts` id, verified_phone_ref, locale, status, deleted_at.
`account_role_grants` account_id, role (customer/driver/vehicle_owner/fleet_admin/staff/gm/accounts/safety/super_admin), verified_by, scope_city_id, status and expiry. A driver+owner uses two grants on the same account.
`driver_profiles` account_id, home_city_id, opt-in preferences, expiry status; sensitive licence/verification data in separate access-controlled records.
`owner_profiles` account_id, organisation/legal verification status and business fields.
`cities`, `zones`, `approved_routes`, `city_legal_profiles` (issuing authority, reference, permit/service restrictions, verified_at/by, expiry), `city_service_gates` (city, service, active/coming_soon, legal profile and operations approvers), `supported_service_modes`.
`role_audit_events`, `consent_records`, `privacy_retention_policies`.

## 2. Vehicle and driver compliance
`vehicle_classes` code, capacity, permitted services, active `asset_id` (reference `assets/3d/manifest.v1.json`) — e.g. BIKE/AUTO/MINI/SEDAN/SUV; do NOT store vehicle class photo URLs as primary service illustration.
`registered_vehicles` owner_id, class_code, plate, make/model where appropriate, seats, actual registration year, operational city, status, fleet_id.
`vehicle_documents` vehicle_id, doc_type, encrypted storage pointer, verified_by/status, expiry. Public customer-facing car class 3D model is a **generic illustration**; actual assigned driver's registration plate and allowed vehicle details must come from verified vehicle records, not illustrative assets.
`driver_credentials`, `police_verifications`, `identity_checks`, `go_online_selfie_checks` access restricted with retention and appeal mechanisms.
`driver_vehicle_links` driver_id, vehicle_id, consented_by_both, start/end, admin_approval, permitted service/city; unique conflict constraint by time and assignment policy.
`driver_service_permissions`, `driver_presence`, `driver_availability_blocks` (including recurring ride obligations); server rechecks eligibility at dispatch/accept/start.

## 3. Booking, route, recurring and shared
`bookings` account_id, service_code, mode, city_id, route snapshot, applicable service permission, quote_version, accepted_at, state, requested preferences.
`booking_legs` booking_id, leg (outbound/return), per-leg pickup/drop, scheduled datetime, state, driver_vehicle_link, start_otp_hash + expiry, safe status timestamps.
`recurrence_plans` owner customer_id, fixed pickup/drop normalized coordinates and geohash, timezone, weekday bitset, start/end, vehicle class, Pink preference, guaranteed/conditional availability policy.
`plan_legs` recurrence_plan_id, leg direction, pickup local time, route; `ride_occurrences` plan_id, plan_leg_id, scheduled_for, independent `booking_leg_id`, cancellation/refund policy snapshot, ETA/status. Generate idempotently with unique plan+leg+service date.
`monthly_pack_catalog` eligible city/routes/service, trip/day allowance, one-way/return options and versioned policy; `monthly_pack_purchases` plan_id, accepted terms snapshot, start/end, used/remaining entitlements and financial ledger reference; `monthly_pack_occurrence_allocations` for per-leg entitlement accounting.
`shared_routes`, `shared_stops`, `shared_departures`, `seat_inventory`, `seat_reservations` with transactional uniqueness/capacity and full passenger-party matching. A separate legal profile identifies commercial ride pooling vs private cost-sharing.
`ride_offers`, `ride_assignments`, `trip_events`, `trip_tracking_points` (retention-limited), `time_limited_share_tokens` (store hash, not raw URL).
Safety: `emergency_events`, `incident_cases`, `incident_escalation_log`, `support_cases` restricted by case/role.
Guardian: `guardian_consents`, `child_travel_profiles`, `authorised_handover_contacts` with purpose limitation, strong access and approved school/escort launch gates. Do NOT expose these in marketing targeting.

## 4. Pricing / commission / payout versioning
`legal_tariff_profiles` jurisdiction/service licence, price floors/caps, payout share floors, authoritative source and effective period.
`pricing_rule_versions` currency, legal_profile_id, city, service, class, mode, route, base/per_km/per_min/wait/peak/outstation and approved state, published effective intervals, reason/audit reference; support nullable components where legally inapplicable.
`commission_rule_versions` city/service/class/route/mode, permitted percent/fixed fee/fee payer + legal validations, effective intervals and admin approval; never silently deploy historic 25%.
`fare_quotes` immutable computed breakdown, route estimate and selected pricing+commission versions, expires_at; `accepted_quotes` immutable snapshot linked to a booking, including pack terms.
`ride_charges`, `payment_intents`, `payment_webhook_events` idempotency key unique, `ledger_entries` immutable balanced entries, `payout_batches`, `refunds` and `financial_audit_events`. Keep marketing revenue entries separate.

## 5. Pink Rider and eligibility
`pink_driver_preferences` driver_id, explicit opt-in, verified eligibility status, women_only or women_plus_men, verified expiry and manual-review status, city-service activation; `pink_customer_preferences` per booking/plan and passenger-party eligibility as lawfully collected/retained.
Never infer sex/gender from photos for customer marketing or silently bypass Pink Only preference. Dispatch enforces eligibility at assignment and fallback; archived evidence minimised.

## 6. Vacancy
`driver_job_profiles` opt-in visibility/search city/radius, eligible licence categories, schedule/salary preferences with redactable owner view.
`vacancies` verified owner_id, city, required vehicle/licence class, salary range and terms, openings, application window, moderation state.
`vacancy_applications` unique active driver+vacancy, immutable submitted snapshot, privacy consent; `vacancy_interviews`, `vacancy_offers` signed agreed offer versions, `employment_links` consent and status, `vacancy_moderation_events`, `vacancy_complaints` and job audit. Applying/hiring never auto-assigns verified ride privileges.

## 7. Promotions and sponsored advertising
`creative_assets` id, kind, owner, content integrity hash, licence reference, aspect ratio, accessible locale text and review status.
`asset_releases` 3D manifest version and hash, approval state, client compatibility and model fallback pair, measured device performance checks. Static 3D model file is built into app/CDN version cache after rights approval; `vehicle_classes.asset_id` must be manifest key.
`ad_slots` stable code `customer_home_promo_carousel` (own) and `customer_home_sponsored_inline` (paid, always labelled), placement constraints and enabled state. Sensitive booking/guardian/SOS/payment/active trip zones are hard-blocked from paid ads.
`advertisers` verified identity and invoice profile, `campaigns` schedule, city/language eligible non-sensitive targeting, spending/frequency caps, disabled flag, versioned landing allowlist; `campaign_creatives` reviewed variants; `campaign_deliveries`, `impressions`, `ad_clicks` privacy-aware minimal identifiers and fraud-deduping; `ad_invoices`, `ad_ledger_entries`; separate content review + payment permissions.
Owned promotions `promo_campaigns`, `promo_rules`, `promo_redemptions` apply only to newly quoted fares and explicit eligibility limits.
No user targeting based on child route, health, sensitive identity/KYC, SOS incident, Pink Rider status or personal trip histories. Define consent, geographic/ad regulations, event retention and deletion before launch.

## 8. Technical security invariants
- Roles are least privilege, server-validated and city-scoped; database RLS or equivalent, separate secure storage, auditable access; customer cannot read driver verification files; owner cannot enumerate all driver private contacts; advertiser never queries rider or trip events.
- Server states and matching rules authoritative, including 3D asset ID served from verified manifest, separate from actual vehicle verification evidence. App never computes binding quote/commission itself.
- Prevent double offers or concurrent bookings with transactional claims/time exclusions; prevent pool overbooking with atomic seat claim; plan/return OTP independent and server-rate-limited.
- Immutable fare/commission snapshots; rate changes never mutate agreed quote or paid packs.
- Signed short-lived live-share links with explicit revocation; SOS operational log owned by staffed support.
- Versioned migration testing, security policy tests, synthetic child/guardian privacy test data only; never import old production data by default.

## 9. Build order / open decisions
- Confirm backend choice before DDL, create new isolated test environment, migration 0001 roles+city and RLS, migration 0002 partner+vehicle verification, migration 0003 quotes/bookings/driver assignments, migration 0004 recurrence+packs, migration 0005 Pink/safety, migration 0006 Vacancy, migration 0007 assets/marketing; integrate only after legal/payment partner checks.
- Open decisions: final fare and share legal profiles, subscription policy and payment mandate, vendor for maps, model renderer/platform limits, campaign billable event model and privacy consent. Placeholder schemas are design guidance, not silently approved legal policy.
