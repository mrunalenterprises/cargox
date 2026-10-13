do $$
begin
  if has_function_privilege('anon','public.loadin_admin_launch_gate_snapshot(text)','EXECUTE') then raise exception 'anon launch gate access'; end if;
  if has_function_privilege('anon','public.loadin_admin_set_launch_check(text,text,text,jsonb)','EXECUTE') then raise exception 'anon launch check mutation access'; end if;
  if has_function_privilege('anon','public.loadin_admin_create_release_signoff(text,text,text,text)','EXECUTE') then raise exception 'anon release signoff access'; end if;
end $$;

-- Main CI runs staff/reconciliation smoke before this file. Remove that test's deliberately
-- broken completed-booking fixture so this launch-gate smoke validates a clean release state.
delete from public.finance_reconciliation_issues
where booking_id in (
  select id from public.bookings
  where customer_id='11111111-1111-4111-8111-111111111111'::uuid
    and partner_id='22222222-2222-4222-8222-222222222222'::uuid
    and status='COMPLETED' and locked_fare=1000
);
delete from public.bookings
where customer_id='11111111-1111-4111-8111-111111111111'::uuid
  and partner_id='22222222-2222-4222-8222-222222222222'::uuid
  and status='COMPLETED' and locked_fare=1000;

insert into auth.users(id) values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
('dddddddd-dddd-4ddd-8ddd-dddddddddddd'),
('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee')
on conflict(id) do nothing;

insert into public.operating_cities(code,name,state_name,enabled,allow_outstation_drop)
values('CSN','CI Launch City','Maharashtra',true,true)
on conflict(code) do update set enabled=true,name=excluded.name;

select public.loadin_bootstrap_super_admin('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','CI Super Admin','Launch control CI');
create or replace function auth.uid() returns uuid language sql stable as $$ select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid $$;
select public.loadin_admin_upsert_staff('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','GM','CSN','CI GM',true,'Launch gate staffing');
select public.loadin_admin_upsert_staff('dddddddd-dddd-4ddd-8ddd-dddddddddddd','ACCOUNTS','CSN','CI Accounts',true,'Launch gate staffing');

insert into public.city_service_controls(city_id,service_code,status)
select c.id,v.service_code,v.status
from public.operating_cities c
cross join (values
  ('PARCEL_2W','COMING_SOON'),
  ('LOADING_VEHICLE','ACTIVE'),
  ('HELPER','COMING_SOON'),
  ('FULL_SHIFTING','COMING_SOON')
) v(service_code,status)
where c.code='CSN'
on conflict(city_id,service_code) do update set status=excluded.status,updated_at=now();

insert into public.pricing_rules(city_code,service_type,vehicle_class,base_fare,extra_km_rate,is_active,effective_from,created_by)
values('CSN','LOADING_VEHICLE','DEFAULT',250,18,true,now(),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

insert into public.partner_profiles(user_id,full_name,city_code,status)
values('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','CI Launch Partner','CSN','ACTIVE')
on conflict(user_id) do update set city_code='CSN',status='ACTIVE';
insert into public.partner_onboarding(partner_id,selfie_verified,bank_verified,staff_approved,admin_decision,onboarding_status)
values('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',true,true,true,'APPROVED','ACTIVE_OFFLINE')
on conflict(partner_id) do update set selfie_verified=true,bank_verified=true,staff_approved=true,admin_decision='APPROVED',onboarding_status='ACTIVE_OFFLINE';
insert into public.partner_vehicles(partner_id,vehicle_category,registration_number,active,eligible_for_booking)
values('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','LOADING_VEHICLE','MH20CI054',true,true)
on conflict(registration_number) do update set active=true,eligible_for_booking=true;

select public.run_loadin_finance_reconciliation(now()-interval '1 hour',now());

update public.production_launch_checks
set status='PASS',evidence='CI verified',checked_by='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',checked_at=now(),updated_at=now()
where required=true;

do $$
declare s jsonb; r jsonb; release_id uuid;
begin
  select public.loadin_admin_launch_gate_snapshot('CSN') into s;
  if coalesce((s->>'releaseReady')::boolean,false) is not true then
    raise exception 'launch gate expected ready: %',s;
  end if;
  if jsonb_array_length(s->'checks') < 10 then raise exception 'launch checks incomplete'; end if;
  if jsonb_array_length(s->'manualChecks') <> 9 then raise exception 'manual launch checks incomplete'; end if;

  select public.loadin_admin_set_launch_check('OTP_REAL_DEVICE','PASS','CI physical-device evidence','{}'::jsonb) into r;
  if r->>'status' <> 'PASS' then raise exception 'launch check save failed'; end if;

  select public.loadin_admin_create_release_signoff('LOADIN CI RC','abcdef1234567','CSN','CI signoff') into r;
  if r->>'status' <> 'READY' then raise exception 'release signoff should be ready: %',r; end if;
  release_id := (r->>'id')::uuid;

  select public.loadin_admin_approve_release_signoff(release_id,'CI approval') into r;
  if r->>'status' <> 'APPROVED' then raise exception 'release approval failed'; end if;
  if not exists(select 1 from public.production_release_signoffs where id=release_id and status='APPROVED') then raise exception 'approved signoff missing'; end if;

  select public.loadin_admin_revoke_release_signoff(release_id,'CI rollback') into r;
  if r->>'status' <> 'REVOKED' then raise exception 'release revoke failed'; end if;
end $$;

create or replace function auth.uid() returns uuid language sql stable as $$ select 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid $$;
do $$
begin
  begin
    perform public.loadin_admin_set_launch_check('OTP_REAL_DEVICE','PASS','GM should not mutate','{}'::jsonb);
    raise exception 'GM launch check mutation should be denied';
  exception when sqlstate '42501' then null;
  end;
end $$;

create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
