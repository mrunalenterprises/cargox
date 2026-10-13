do $$
begin
  if has_function_privilege('anon','public.loadin_admin_staff_snapshot()','EXECUTE') then raise exception 'anon staff snapshot access'; end if;
  if has_function_privilege('anon','public.loadin_admin_upsert_staff(uuid,text,text,text,boolean,text)','EXECUTE') then raise exception 'anon staff mutation access'; end if;
  if has_function_privilege('authenticated','public.loadin_bootstrap_super_admin(uuid,text,text)','EXECUTE') then raise exception 'authenticated bootstrap access'; end if;
  if not has_function_privilege('service_role','public.loadin_bootstrap_super_admin(uuid,text,text)','EXECUTE') then raise exception 'service role bootstrap missing'; end if;
  if has_function_privilege('anon','public.loadin_admin_finance_reconciliation_snapshot()','EXECUTE') then raise exception 'anon reconciliation access'; end if;
  if has_function_privilege('authenticated','public.run_loadin_finance_reconciliation(timestamptz,timestamptz)','EXECUTE') then raise exception 'authenticated internal reconciliation access'; end if;
end $$;

insert into auth.users(id) values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
('cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
('dddddddd-dddd-4ddd-8ddd-dddddddddddd')
on conflict(id) do nothing;

insert into public.operating_cities(code,name,state_name,enabled,allow_outstation_drop)
values('CSN','CI City','Maharashtra',true,true)
on conflict(code) do update set enabled=true;

select public.loadin_bootstrap_super_admin('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','CI Super Admin','CI bootstrap');

create or replace function auth.uid() returns uuid language sql stable as $$ select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid $$;
select public.loadin_admin_upsert_staff('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','GM','CSN','CI GM',true,'CI appointment');
select public.loadin_admin_upsert_staff('cccccccc-cccc-4ccc-8ccc-cccccccccccc','FIELD_OFFICER','CSN','CI FO',true,'CI appointment');
select public.loadin_admin_upsert_staff('dddddddd-dddd-4ddd-8ddd-dddddddddddd','ACCOUNTS','CSN','CI Accounts',true,'CI appointment');

do $$
declare s jsonb;
begin
  select public.loadin_admin_staff_snapshot() into s;
  if s->>'role' <> 'SUPER_ADMIN' then raise exception 'wrong staff snapshot role'; end if;
  if jsonb_array_length(s->'staff') < 4 then raise exception 'staff snapshot incomplete'; end if;
end $$;

create or replace function auth.uid() returns uuid language sql stable as $$ select 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid $$;
select public.loadin_admin_upsert_staff('cccccccc-cccc-4ccc-8ccc-cccccccccccc','FIELD_OFFICER','CSN','CI FO Updated',true,'GM update');

do $$
begin
  begin
    perform public.loadin_admin_upsert_staff('dddddddd-dddd-4ddd-8ddd-dddddddddddd','ACCOUNTS','CSN','Blocked',true,'scope test');
    raise exception 'GM scope test failed';
  exception when sqlstate '42501' then null;
  end;
end $$;

create or replace function auth.uid() returns uuid language sql stable as $$ select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid $$;
insert into public.bookings(customer_id,partner_id,city_code,service_code,status,booking_mode,pickup_address,drop_address,fare_locked,locked_fare,customer_payment_mode,completed_at)
values('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','CSN','LOADING_VEHICLE','COMPLETED','NOW','CI Pickup','CI Drop',true,1000,'CASH',now());

do $$
declare r jsonb; s jsonb; issue_id uuid;
begin
  select public.loadin_admin_run_finance_reconciliation(24) into r;
  if coalesce((r->>'p0')::integer,0) < 1 then raise exception 'missing settlement not detected'; end if;
  select public.loadin_admin_finance_reconciliation_snapshot() into s;
  if jsonb_array_length(s->'issues') < 1 then raise exception 'reconciliation snapshot empty'; end if;
  select id into issue_id from public.finance_reconciliation_issues where status='OPEN' order by created_at desc limit 1;
  perform public.loadin_admin_resolve_reconciliation_issue(issue_id,'RESOLVED','CI reviewed');
end $$;

create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
