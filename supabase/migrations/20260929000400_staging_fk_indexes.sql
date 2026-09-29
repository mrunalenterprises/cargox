-- Additive indexes on isolated PIP PIP staging: FK planner guidance only.
-- Does not alter RLS, role permissions, service gates or existing data.
begin;
create index if not exists idx_fo_teams_gm_id on private.fo_teams(gm_id);
create index if not exists idx_audit_events_actor_id on public.audit_events(actor_id);
create index if not exists idx_incidents_reporter_id on public.incidents(reporter_id);
create index if not exists idx_incidents_ride_id on public.incidents(ride_id);
create index if not exists idx_ledger_entries_pack_id on public.ledger_entries(pack_id);
create index if not exists idx_ledger_entries_ride_id on public.ledger_entries(ride_id);
create index if not exists idx_monthly_packs_city_id on public.monthly_packs(city_id);
create index if not exists idx_monthly_packs_customer_id on public.monthly_packs(customer_id);
create index if not exists idx_partner_applications_admin_reviewer on public.partner_applications(admin_reviewer);
create index if not exists idx_partner_applications_assigned_fo on public.partner_applications(assigned_fo);
create index if not exists idx_partner_applications_city_id on public.partner_applications(city_id);
create index if not exists idx_partner_applications_staff_reviewer on public.partner_applications(staff_reviewer);
create index if not exists idx_partners_city_id on public.partners(city_id);
create index if not exists idx_rides_city_id on public.rides(city_id);
commit;
