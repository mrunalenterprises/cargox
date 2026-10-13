do $$
begin
  if has_function_privilege('anon','public.loadin_admin_city_service_config_snapshot(text)','EXECUTE') then raise exception 'anon must not read admin city config snapshot'; end if;
  if has_function_privilege('anon','public.loadin_admin_set_city_pricing(text,text,numeric,numeric,text)','EXECUTE') then raise exception 'anon must not change pricing'; end if;
  if not has_function_privilege('authenticated','public.loadin_admin_set_city_pricing(text,text,numeric,numeric,text)','EXECUTE') then raise exception 'authenticated grant missing for scoped pricing rpc'; end if;
end $$;

create or replace function auth.uid()
returns uuid language sql stable
as $$ select '55555555-5555-4555-8555-555555555555'::uuid $$;

insert into public.admin_members(user_id,role,city_code,is_active)
values('55555555-5555-4555-8555-555555555555','SUPER_ADMIN',null,true);
insert into public.operating_cities(code,name,state_name,enabled)
values('CSN','Chhatrapati Sambhaji Nagar','Maharashtra',true)
on conflict(code) do update set enabled=true;

select public.loadin_admin_set_city_service_status('CSN','PARCEL_2W','ACTIVE','CI enable');
select public.loadin_admin_set_city_pricing('CSN','PARCEL_2W',40,9,'CI pricing');

do $$
declare
  v_snapshot jsonb;
  v_service jsonb;
begin
  if not exists(
    select 1 from public.city_service_controls c
    join public.operating_cities oc on oc.id=c.city_id
    where oc.code='CSN' and c.service_code='PARCEL_2W' and c.status='ACTIVE'
  ) then raise exception 'city service status was not saved'; end if;

  if not exists(
    select 1 from public.pricing_rules
    where city_code='CSN' and service_type='PARCEL_2W' and vehicle_class='DEFAULT' and is_active=true and base_fare=40 and extra_km_rate=9
  ) then raise exception 'active city pricing rule missing'; end if;

  if not exists(select 1 from public.admin_pricing_changes where city_code='CSN' and service_code='PARCEL_2W' and reason='CI pricing') then raise exception 'pricing audit change missing'; end if;
  if not exists(select 1 from public.admin_audit_log where action='SET_CITY_PRICING' and reason='CI pricing') then raise exception 'admin pricing audit missing'; end if;

  v_snapshot:=public.loadin_admin_city_service_config_snapshot('CSN');
  select value into v_service from jsonb_array_elements(v_snapshot->'services') where value->>'code'='PARCEL_2W';
  if v_service is null then raise exception 'snapshot missing parcel service'; end if;
  if (v_service->>'base_fare')::numeric <> 40 or (v_service->>'extra_km_rate')::numeric <> 9 then raise exception 'snapshot pricing mismatch'; end if;
  if (v_service->>'commission_pct')::numeric <> 15 then raise exception 'commission lock mismatch'; end if;
end $$;

create or replace function auth.uid()
returns uuid language sql stable
as $$ select '66666666-6666-4666-8666-666666666666'::uuid $$;
insert into public.admin_members(user_id,role,city_code,is_active)
values('66666666-6666-4666-8666-666666666666','GM','JALNA',true);

do $$
begin
  begin
    perform public.loadin_admin_set_city_pricing('CSN','PARCEL_2W',41,10,'must fail');
    raise exception 'expected admin_city_scope_denied';
  exception when insufficient_privilege then null;
  end;
end $$;

delete from public.admin_pricing_changes where city_code='CSN' and service_code='PARCEL_2W';
delete from public.admin_audit_log where actor_user_id in ('55555555-5555-4555-8555-555555555555'::uuid,'66666666-6666-4666-8666-666666666666'::uuid);
delete from public.pricing_rules where city_code='CSN' and service_type='PARCEL_2W' and vehicle_class='DEFAULT';
delete from public.city_service_change_log where city_id in (select id from public.operating_cities where code='CSN');
delete from public.city_service_controls where city_id in (select id from public.operating_cities where code='CSN');
delete from public.operating_cities where code='CSN';
delete from public.admin_members where user_id in ('55555555-5555-4555-8555-555555555555'::uuid,'66666666-6666-4666-8666-666666666666'::uuid);

create or replace function auth.uid()
returns uuid language sql stable
as $$ select null::uuid $$;
