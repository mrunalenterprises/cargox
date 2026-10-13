-- Secure Fleet mutations for production Fleet portal.

create table if not exists public.fleet_activity_log (
  id uuid primary key default gen_random_uuid(),
  fleet_account_id uuid not null references public.fleet_accounts(id) on delete cascade,
  actor_user_id uuid not null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.fleet_activity_log enable row level security;

create policy "fleet_owner_read_activity" on public.fleet_activity_log
for select using (
  exists (
    select 1 from public.fleet_accounts a
    where a.id = fleet_account_id and a.owner_user_id = auth.uid()
  )
);

create index if not exists fleet_activity_account_created_idx
on public.fleet_activity_log(fleet_account_id, created_at desc);

create or replace function public.require_my_fleet_account()
returns public.fleet_accounts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_account public.fleet_accounts;
begin
  if v_uid is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select * into v_account
  from public.fleet_accounts
  where owner_user_id = v_uid and status = 'active'
  order by created_at
  limit 1;

  if not found then
    raise exception 'fleet_account_required' using errcode = '42501';
  end if;

  return v_account;
end
$$;

create or replace function public.loadin_fleet_add_vehicle(
  p_registration_number text,
  p_vehicle_type text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_account public.fleet_accounts;
  v_registration text := upper(regexp_replace(trim(coalesce(p_registration_number,'')), '\s+', '', 'g'));
  v_type text := upper(trim(coalesce(p_vehicle_type,'')));
  v_vehicle public.fleet_vehicles;
begin
  v_account := public.require_my_fleet_account();
  if length(v_registration) < 5 or length(v_registration) > 20 then
    raise exception 'invalid_registration_number' using errcode = '22023';
  end if;
  if length(v_type) < 2 or length(v_type) > 80 then
    raise exception 'invalid_vehicle_type' using errcode = '22023';
  end if;

  insert into public.fleet_vehicles(fleet_account_id,registration_number,vehicle_type,status)
  values(v_account.id,v_registration,v_type,'active')
  returning * into v_vehicle;

  insert into public.fleet_activity_log(fleet_account_id,actor_user_id,action,entity_type,entity_id,detail)
  values(v_account.id,auth.uid(),'ADD_VEHICLE','FLEET_VEHICLE',v_vehicle.id,jsonb_build_object('registration_number',v_vehicle.registration_number,'vehicle_type',v_vehicle.vehicle_type));

  return jsonb_build_object('id',v_vehicle.id,'registration_number',v_vehicle.registration_number,'vehicle_type',v_vehicle.vehicle_type,'status',upper(v_vehicle.status));
exception when unique_violation then
  raise exception 'vehicle_registration_already_exists' using errcode = '23505';
end
$$;

create or replace function public.loadin_fleet_add_driver(
  p_full_name text,
  p_mobile text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_account public.fleet_accounts;
  v_name text := trim(coalesce(p_full_name,''));
  v_mobile text := nullif(regexp_replace(trim(coalesce(p_mobile,'')), '[^0-9+]', '', 'g'),'');
  v_driver public.fleet_drivers;
begin
  v_account := public.require_my_fleet_account();
  if length(v_name) < 2 or length(v_name) > 120 then
    raise exception 'invalid_driver_name' using errcode = '22023';
  end if;
  if v_mobile is not null and v_mobile !~ '^\+?[0-9]{10,15}$' then
    raise exception 'invalid_driver_mobile' using errcode = '22023';
  end if;

  insert into public.fleet_drivers(fleet_account_id,full_name,mobile,status)
  values(v_account.id,v_name,v_mobile,'active')
  returning * into v_driver;

  insert into public.fleet_activity_log(fleet_account_id,actor_user_id,action,entity_type,entity_id,detail)
  values(v_account.id,auth.uid(),'ADD_DRIVER','FLEET_DRIVER',v_driver.id,jsonb_build_object('full_name',v_driver.full_name,'mobile',v_driver.mobile));

  return jsonb_build_object('id',v_driver.id,'name',v_driver.full_name,'phone',v_driver.mobile,'status',upper(v_driver.status));
end
$$;

create or replace function public.loadin_fleet_assign_driver(
  p_vehicle_id uuid,
  p_driver_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_account public.fleet_accounts;
  v_vehicle public.fleet_vehicles;
  v_driver public.fleet_drivers;
  v_assignment public.fleet_driver_vehicle_assignments;
begin
  v_account := public.require_my_fleet_account();

  select * into v_vehicle from public.fleet_vehicles
  where id = p_vehicle_id and fleet_account_id = v_account.id
  for update;
  if not found then raise exception 'fleet_vehicle_not_found' using errcode = 'P0002'; end if;
  if v_vehicle.status <> 'active' then raise exception 'fleet_vehicle_not_assignable' using errcode = '22023'; end if;

  select * into v_driver from public.fleet_drivers
  where id = p_driver_id and fleet_account_id = v_account.id
  for update;
  if not found then raise exception 'fleet_driver_not_found' using errcode = 'P0002'; end if;
  if v_driver.status <> 'active' then raise exception 'fleet_driver_not_assignable' using errcode = '22023'; end if;

  if exists(select 1 from public.fleet_driver_vehicle_assignments where fleet_account_id=v_account.id and status='active' and (fleet_vehicle_id=p_vehicle_id or fleet_driver_id=p_driver_id)) then
    raise exception 'active_assignment_conflict' using errcode = '23505';
  end if;

  insert into public.fleet_driver_vehicle_assignments(fleet_account_id,fleet_vehicle_id,fleet_driver_id,status)
  values(v_account.id,p_vehicle_id,p_driver_id,'active')
  returning * into v_assignment;

  insert into public.fleet_activity_log(fleet_account_id,actor_user_id,action,entity_type,entity_id,detail)
  values(v_account.id,auth.uid(),'ASSIGN_DRIVER','FLEET_ASSIGNMENT',v_assignment.id,jsonb_build_object('vehicle_id',p_vehicle_id,'driver_id',p_driver_id));

  return jsonb_build_object('id',v_assignment.id,'vehicle_id',p_vehicle_id,'driver_id',p_driver_id,'status',upper(v_assignment.status),'assigned_at',v_assignment.assigned_at);
end
$$;

create or replace function public.loadin_fleet_end_assignment(p_assignment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_account public.fleet_accounts;
  v_assignment public.fleet_driver_vehicle_assignments;
begin
  v_account := public.require_my_fleet_account();
  select * into v_assignment
  from public.fleet_driver_vehicle_assignments
  where id=p_assignment_id and fleet_account_id=v_account.id and status='active'
  for update;
  if not found then raise exception 'active_assignment_not_found' using errcode = 'P0002'; end if;

  update public.fleet_driver_vehicle_assignments
  set status='ended',ended_at=now()
  where id=v_assignment.id
  returning * into v_assignment;

  insert into public.fleet_activity_log(fleet_account_id,actor_user_id,action,entity_type,entity_id,detail)
  values(v_account.id,auth.uid(),'END_ASSIGNMENT','FLEET_ASSIGNMENT',v_assignment.id,jsonb_build_object('vehicle_id',v_assignment.fleet_vehicle_id,'driver_id',v_assignment.fleet_driver_id));

  return jsonb_build_object('id',v_assignment.id,'status',upper(v_assignment.status),'ended_at',v_assignment.ended_at);
end
$$;

create or replace function public.loadin_fleet_set_vehicle_status(p_vehicle_id uuid,p_status text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_account public.fleet_accounts;
  v_vehicle public.fleet_vehicles;
  v_status text := lower(trim(coalesce(p_status,'')));
begin
  v_account := public.require_my_fleet_account();
  if v_status not in ('active','inactive','maintenance') then raise exception 'invalid_vehicle_status' using errcode='22023'; end if;
  select * into v_vehicle from public.fleet_vehicles where id=p_vehicle_id and fleet_account_id=v_account.id for update;
  if not found then raise exception 'fleet_vehicle_not_found' using errcode='P0002'; end if;
  if v_vehicle.status='blocked' then raise exception 'blocked_vehicle_requires_compliance_review' using errcode='42501'; end if;
  if v_status<>'active' and exists(select 1 from public.fleet_driver_vehicle_assignments where fleet_vehicle_id=p_vehicle_id and status='active') then
    raise exception 'end_active_assignment_first' using errcode='22023';
  end if;
  update public.fleet_vehicles set status=v_status where id=p_vehicle_id returning * into v_vehicle;
  insert into public.fleet_activity_log(fleet_account_id,actor_user_id,action,entity_type,entity_id,detail)
  values(v_account.id,auth.uid(),'SET_VEHICLE_STATUS','FLEET_VEHICLE',v_vehicle.id,jsonb_build_object('status',v_vehicle.status));
  return jsonb_build_object('id',v_vehicle.id,'status',upper(v_vehicle.status));
end
$$;

create or replace function public.loadin_fleet_set_driver_status(p_driver_id uuid,p_status text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_account public.fleet_accounts;
  v_driver public.fleet_drivers;
  v_status text := lower(trim(coalesce(p_status,'')));
begin
  v_account := public.require_my_fleet_account();
  if v_status not in ('active','inactive') then raise exception 'invalid_driver_status' using errcode='22023'; end if;
  select * into v_driver from public.fleet_drivers where id=p_driver_id and fleet_account_id=v_account.id for update;
  if not found then raise exception 'fleet_driver_not_found' using errcode='P0002'; end if;
  if v_driver.status='blocked' then raise exception 'blocked_driver_requires_review' using errcode='42501'; end if;
  if v_status<>'active' and exists(select 1 from public.fleet_driver_vehicle_assignments where fleet_driver_id=p_driver_id and status='active') then
    raise exception 'end_active_assignment_first' using errcode='22023';
  end if;
  update public.fleet_drivers set status=v_status where id=p_driver_id returning * into v_driver;
  insert into public.fleet_activity_log(fleet_account_id,actor_user_id,action,entity_type,entity_id,detail)
  values(v_account.id,auth.uid(),'SET_DRIVER_STATUS','FLEET_DRIVER',v_driver.id,jsonb_build_object('status',v_driver.status));
  return jsonb_build_object('id',v_driver.id,'status',upper(v_driver.status));
end
$$;

revoke all on function public.require_my_fleet_account() from public, anon;
revoke all on function public.loadin_fleet_add_vehicle(text,text) from public, anon;
revoke all on function public.loadin_fleet_add_driver(text,text) from public, anon;
revoke all on function public.loadin_fleet_assign_driver(uuid,uuid) from public, anon;
revoke all on function public.loadin_fleet_end_assignment(uuid) from public, anon;
revoke all on function public.loadin_fleet_set_vehicle_status(uuid,text) from public, anon;
revoke all on function public.loadin_fleet_set_driver_status(uuid,text) from public, anon;

grant execute on function public.require_my_fleet_account() to authenticated, service_role;
grant execute on function public.loadin_fleet_add_vehicle(text,text) to authenticated, service_role;
grant execute on function public.loadin_fleet_add_driver(text,text) to authenticated, service_role;
grant execute on function public.loadin_fleet_assign_driver(uuid,uuid) to authenticated, service_role;
grant execute on function public.loadin_fleet_end_assignment(uuid) to authenticated, service_role;
grant execute on function public.loadin_fleet_set_vehicle_status(uuid,text) to authenticated, service_role;
grant execute on function public.loadin_fleet_set_driver_status(uuid,text) to authenticated, service_role;
