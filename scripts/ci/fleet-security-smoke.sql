do $$
begin
  if has_function_privilege('anon','public.loadin_fleet_add_vehicle(text,text)','EXECUTE') then raise exception 'anon must not add fleet vehicle'; end if;
  if has_function_privilege('anon','public.loadin_fleet_add_driver(text,text)','EXECUTE') then raise exception 'anon must not add fleet driver'; end if;
  if has_function_privilege('anon','public.loadin_fleet_assign_driver(uuid,uuid)','EXECUTE') then raise exception 'anon must not assign fleet driver'; end if;
  if has_function_privilege('anon','public.loadin_fleet_end_assignment(uuid)','EXECUTE') then raise exception 'anon must not end fleet assignment'; end if;
  if not has_function_privilege('authenticated','public.loadin_fleet_add_vehicle(text,text)','EXECUTE') then raise exception 'authenticated must add fleet vehicle'; end if;
  if not has_function_privilege('authenticated','public.loadin_fleet_add_driver(text,text)','EXECUTE') then raise exception 'authenticated must add fleet driver'; end if;
end $$;

create or replace function auth.uid()
returns uuid
language sql
stable
as $$ select '33333333-3333-4333-8333-333333333333'::uuid $$;

insert into public.fleet_accounts(owner_user_id,business_name,status)
values('33333333-3333-4333-8333-333333333333','CI Fleet','active');

select public.loadin_fleet_add_vehicle('mh20 ci 1234','TATA_ACE');
select public.loadin_fleet_add_driver('CI Driver','+919900001234');

do $$
declare
  v_account uuid;
  v_vehicle uuid;
  v_driver uuid;
  v_assignment jsonb;
  v_snapshot jsonb;
begin
  select id into v_account from public.fleet_accounts where owner_user_id=auth.uid();
  select id into v_vehicle from public.fleet_vehicles where fleet_account_id=v_account;
  select id into v_driver from public.fleet_drivers where fleet_account_id=v_account;

  if not exists(select 1 from public.fleet_vehicles where id=v_vehicle and registration_number='MH20CI1234') then raise exception 'vehicle normalization failed'; end if;
  if not exists(select 1 from public.fleet_activity_log where fleet_account_id=v_account and action='ADD_VEHICLE') then raise exception 'vehicle activity missing'; end if;
  if not exists(select 1 from public.fleet_activity_log where fleet_account_id=v_account and action='ADD_DRIVER') then raise exception 'driver activity missing'; end if;

  v_assignment := public.loadin_fleet_assign_driver(v_vehicle,v_driver);
  if v_assignment->>'status' <> 'ACTIVE' then raise exception 'assignment not active'; end if;

  v_snapshot := public.loadin_fleet_snapshot();
  if jsonb_array_length(coalesce(v_snapshot->'vehicles','[]'::jsonb)) <> 1 then raise exception 'snapshot vehicle count wrong'; end if;
  if coalesce(v_snapshot->'vehicles'->0->>'assignment_id','') = '' then raise exception 'snapshot missing assignment id'; end if;
  if jsonb_array_length(coalesce(v_snapshot->'activity','[]'::jsonb)) < 3 then raise exception 'snapshot activity missing'; end if;

  begin
    perform public.loadin_fleet_assign_driver(v_vehicle,v_driver);
    raise exception 'expected active_assignment_conflict';
  exception when unique_violation then null;
  end;

  perform public.loadin_fleet_end_assignment((v_assignment->>'id')::uuid);
  perform public.loadin_fleet_set_vehicle_status(v_vehicle,'maintenance');
  perform public.loadin_fleet_set_driver_status(v_driver,'inactive');

  if not exists(select 1 from public.fleet_vehicles where id=v_vehicle and status='maintenance') then raise exception 'vehicle status update failed'; end if;
  if not exists(select 1 from public.fleet_drivers where id=v_driver and status='inactive') then raise exception 'driver status update failed'; end if;
end $$;

delete from public.fleet_accounts where owner_user_id='33333333-3333-4333-8333-333333333333'::uuid;

create or replace function auth.uid()
returns uuid
language sql
stable
as $$ select null::uuid $$;
