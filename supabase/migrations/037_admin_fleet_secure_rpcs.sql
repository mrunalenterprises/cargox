-- Secure admin/fleet read and mutation RPCs so production portals do not require browser service-role access.

create or replace function public.require_loadin_admin(p_roles text[] default null)
returns public.admin_members
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_member public.admin_members;
begin
  if v_uid is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select * into v_member
  from public.admin_members
  where user_id = v_uid and is_active = true;

  if not found then
    raise exception 'admin_access_required' using errcode = '42501';
  end if;

  if p_roles is not null and not (v_member.role = any(p_roles)) then
    raise exception 'admin_role_not_allowed' using errcode = '42501';
  end if;

  return v_member;
end
$$;

create or replace function public.loadin_admin_dashboard_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member public.admin_members;
  v_city text;
  v_can_finance boolean;
  v_result jsonb;
begin
  v_member := public.require_loadin_admin(null);
  v_city := case when v_member.role = 'SUPER_ADMIN' then null else v_member.city_code end;
  v_can_finance := v_member.role in ('SUPER_ADMIN','GM','ACCOUNTS');

  select jsonb_build_object(
    'role', v_member.role,
    'cityCode', v_member.city_code,
    'metrics', jsonb_build_object(
      'bookings', count(*),
      'active', count(*) filter (where b.status in ('SEARCHING','ASSIGNED','PARTNER_ARRIVING','AT_PICKUP','IN_PROGRESS')),
      'completed', count(*) filter (where b.status = 'COMPLETED'),
      'cancelled', count(*) filter (where b.status = 'CANCELLED'),
      'gbv', coalesce(sum(b.locked_fare),0),
      'onlinePartners', (
        select count(*) from public.partner_availability pa
        join public.partner_profiles pp on pp.user_id = pa.partner_id
        where pa.online_status in ('ONLINE','BUSY')
          and (v_city is null or pp.city_code = v_city)
      ),
      'customers', (
        select count(*) from public.customer_profiles cp
        where v_city is null or cp.city_code = v_city
      ),
      'openSupport', (
        select count(*) from public.support_cases sc
        join public.bookings sb on sb.id = sc.booking_id
        where sc.status not in ('RESOLVED','CLOSED')
          and (v_city is null or sb.city_code = v_city)
      ),
      'pendingPayout', case when v_can_finance then (
        select coalesce(sum(fa.pending_payout),0)
        from public.partner_finance_accounts fa
        join public.partner_profiles pp on pp.user_id = fa.partner_id
        where v_city is null or pp.city_code = v_city
      ) else 0 end,
      'netRevenue', case when v_can_finance then (
        select coalesce(sum(s.commission_amount),0)
        from public.booking_partner_settlements s
        join public.bookings sb on sb.id = s.booking_id
        where s.status in ('CALCULATED','SETTLED')
          and (v_city is null or sb.city_code = v_city)
      ) else 0 end,
      'health', 94
    ),
    'liveOps', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b2.id,
        'type', case when b2.status = 'SEARCHING' then 'Unassigned Booking' else 'Active Trip' end,
        'route', coalesce(b2.pickup_address,'') || ' → ' || coalesce(b2.drop_address,''),
        'severity', case when b2.status = 'SEARCHING' then 'P1' else 'P2' end,
        'status', b2.status
      ) order by b2.created_at desc)
      from public.bookings b2
      where b2.status in ('SEARCHING','ASSIGNED','PARTNER_ARRIVING','AT_PICKUP','IN_PROGRESS')
        and (v_city is null or b2.city_code = v_city)
    ), '[]'::jsonb),
    'partners', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pp.user_id,
        'name', coalesce(pp.full_name,'Partner'),
        'vehicle', coalesce(pv.vehicle_category,'—'),
        'quality', coalesce(pq.quality_score,0),
        'status', coalesce(pa.online_status,pp.status)
      ) order by pp.updated_at desc)
      from public.partner_profiles pp
      left join public.partner_availability pa on pa.partner_id = pp.user_id
      left join lateral (
        select vehicle_category from public.partner_vehicles v
        where v.partner_id = pp.user_id order by v.updated_at desc limit 1
      ) pv on true
      left join public.partner_quality_scores pq on pq.partner_id = pp.user_id
      where v_city is null or pp.city_code = v_city
      limit 100
    ), '[]'::jsonb),
    'bookings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b3.id,
        'service', b3.service_code,
        'fare', b3.locked_fare,
        'status', b3.status,
        'pickup_address', b3.pickup_address,
        'drop_address', b3.drop_address,
        'partner_id', b3.partner_id,
        'city_code', b3.city_code
      ) order by b3.created_at desc)
      from (select * from public.bookings bx where (v_city is null or bx.city_code = v_city) order by bx.created_at desc limit 100) b3
    ), '[]'::jsonb),
    'supportCases', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', sc.id,
        'booking_id', sc.booking_id,
        'category', sc.category,
        'priority', case sc.priority when 'URGENT' then 'P0' when 'HIGH' then 'P1' when 'NORMAL' then 'P2' else 'P3' end,
        'status', sc.status,
        'owner', case when sc.safety_risk then 'SAFETY' when sc.active_trip_escalation then 'ACTIVE_TRIP_SUPPORT' else 'SUPPORT' end
      ) order by sc.created_at desc)
      from public.support_cases sc
      join public.bookings sb on sb.id = sc.booking_id
      where (v_city is null or sb.city_code = v_city)
      limit 100
    ), '[]'::jsonb)
  ) into v_result
  from public.bookings b
  where v_city is null or b.city_code = v_city;

  return v_result;
end
$$;

create or replace function public.loadin_admin_resolve_support_case(
  p_case_id uuid,
  p_resolution_notes text default 'Resolved by admin'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member public.admin_members;
  v_case public.support_cases;
  v_city text;
begin
  v_member := public.require_loadin_admin(array['SUPER_ADMIN','GM']);

  select sc.*, b.city_code into v_case, v_city
  from public.support_cases sc
  join public.bookings b on b.id = sc.booking_id
  where sc.id = p_case_id
  for update of sc;

  if not found then raise exception 'support_case_not_found' using errcode = 'P0002'; end if;
  if v_member.role <> 'SUPER_ADMIN' and v_member.city_code is distinct from v_city then
    raise exception 'admin_city_scope_denied' using errcode = '42501';
  end if;

  update public.support_cases
  set status = 'RESOLVED', resolution_notes = nullif(trim(coalesce(p_resolution_notes,'')),''),
      resolved_at = now(), updated_at = now(), case_owner_id = v_member.user_id
  where id = p_case_id
  returning * into v_case;

  insert into public.support_case_events(case_id, actor_id, actor_role, event_type, note)
  values (p_case_id, v_member.user_id, v_member.role, 'ADMIN_RESOLVED', p_resolution_notes);

  insert into public.admin_audit_log(actor_user_id,actor_role,action,entity_type,entity_id,after_data,reason)
  values (v_member.user_id,v_member.role,'RESOLVE_SUPPORT_CASE','SUPPORT_CASE',p_case_id::text,to_jsonb(v_case),p_resolution_notes);

  return jsonb_build_object('id',v_case.id,'status',v_case.status,'resolved_at',v_case.resolved_at);
end
$$;

create or replace function public.loadin_admin_set_city_service_status(
  p_city_code text,
  p_service_code text,
  p_status text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member public.admin_members;
  v_city public.operating_cities;
  v_control public.city_service_controls;
  v_old text;
  v_new text := upper(trim(coalesce(p_status,'')));
begin
  v_member := public.require_loadin_admin(array['SUPER_ADMIN','GM']);

  if v_new not in ('ACTIVE','COMING_SOON','PAUSED','DISABLED') then
    raise exception 'invalid_service_status' using errcode = '22023';
  end if;

  select * into v_city from public.operating_cities where code = p_city_code;
  if not found then raise exception 'city_not_found' using errcode = 'P0002'; end if;
  if v_member.role <> 'SUPER_ADMIN' and v_member.city_code is distinct from v_city.code then
    raise exception 'admin_city_scope_denied' using errcode = '42501';
  end if;

  select * into v_control
  from public.city_service_controls
  where city_id = v_city.id and service_code = p_service_code
  for update;

  if not found then
    insert into public.city_service_controls(city_id,service_code,status,notes)
    values(v_city.id,p_service_code,v_new,p_reason)
    returning * into v_control;
    v_old := null;
  else
    v_old := v_control.status;
    update public.city_service_controls
    set status = v_new, notes = coalesce(p_reason,notes), updated_at = now()
    where id = v_control.id returning * into v_control;
  end if;

  insert into public.city_service_change_log(city_id,service_control_id,actor_id,old_status,new_status,reason)
  values(v_city.id,v_control.id,v_member.user_id,v_old,v_new,p_reason);

  insert into public.admin_audit_log(actor_user_id,actor_role,action,entity_type,entity_id,before_data,after_data,reason)
  values(v_member.user_id,v_member.role,'SET_CITY_SERVICE_STATUS','CITY_SERVICE',v_control.id::text,
    jsonb_build_object('status',v_old),jsonb_build_object('status',v_new,'city_code',v_city.code,'service_code',v_control.service_code),p_reason);

  return jsonb_build_object('city_code',v_city.code,'service_code',v_control.service_code,'status',v_control.status,'updated_at',v_control.updated_at);
end
$$;

create or replace function public.loadin_fleet_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_account public.fleet_accounts;
  v_result jsonb;
begin
  if v_uid is null then raise exception 'authentication_required' using errcode = '42501'; end if;

  select * into v_account
  from public.fleet_accounts
  where owner_user_id = v_uid and status = 'active'
  order by created_at limit 1;

  if not found then
    return jsonb_build_object('account',null,'vehicles','[]'::jsonb,'drivers','[]'::jsonb,'bookings','[]'::jsonb,'earnings','[]'::jsonb);
  end if;

  select jsonb_build_object(
    'account', to_jsonb(v_account),
    'vehicles', coalesce((select jsonb_agg(jsonb_build_object(
      'id',fv.id,'type',fv.vehicle_type,'registration_number',fv.registration_number,'status',upper(fv.status),
      'driver',coalesce(fd.full_name,'—'),'docs',case when fv.status='blocked' then 'Blocked' else 'Valid' end
    ) order by fv.created_at desc)
      from public.fleet_vehicles fv
      left join public.fleet_driver_vehicle_assignments a on a.fleet_vehicle_id=fv.id and a.status='active'
      left join public.fleet_drivers fd on fd.id=a.fleet_driver_id
      where fv.fleet_account_id=v_account.id),'[]'::jsonb),
    'drivers', coalesce((select jsonb_agg(jsonb_build_object(
      'id',fd.id,'name',fd.full_name,'phone',fd.mobile,'status',upper(fd.status),'partner_user_id',fd.partner_user_id,
      'vehicle',coalesce(fv.registration_number,'—')
    ) order by fd.created_at desc)
      from public.fleet_drivers fd
      left join public.fleet_driver_vehicle_assignments a on a.fleet_driver_id=fd.id and a.status='active'
      left join public.fleet_vehicles fv on fv.id=a.fleet_vehicle_id
      where fd.fleet_account_id=v_account.id),'[]'::jsonb),
    'bookings', coalesce((select jsonb_agg(jsonb_build_object(
      'id',b.id,'route',coalesce(b.pickup_address,'')||' → '||coalesce(b.drop_address,''),'status',b.status,
      'vehicle',coalesce(b.vehicle_class,'—'),'fare',b.locked_fare,'partner_id',b.partner_id
    ) order by b.created_at desc)
      from public.bookings b
      where exists(select 1 from public.fleet_drivers fd where fd.fleet_account_id=v_account.id and fd.partner_user_id=b.partner_id)
      limit 100),'[]'::jsonb),
    'earnings', coalesce((select jsonb_agg(to_jsonb(es) order by es.period_start desc)
      from public.fleet_earning_snapshots es where es.fleet_account_id=v_account.id),'[]'::jsonb)
  ) into v_result;

  return v_result;
end
$$;

revoke all on function public.require_loadin_admin(text[]) from public, anon;
revoke all on function public.loadin_admin_dashboard_snapshot() from public, anon;
revoke all on function public.loadin_admin_resolve_support_case(uuid,text) from public, anon;
revoke all on function public.loadin_admin_set_city_service_status(text,text,text,text) from public, anon;
revoke all on function public.loadin_fleet_snapshot() from public, anon;

grant execute on function public.require_loadin_admin(text[]) to authenticated, service_role;
grant execute on function public.loadin_admin_dashboard_snapshot() to authenticated, service_role;
grant execute on function public.loadin_admin_resolve_support_case(uuid,text) to authenticated, service_role;
grant execute on function public.loadin_admin_set_city_service_status(text,text,text,text) to authenticated, service_role;
grant execute on function public.loadin_fleet_snapshot() to authenticated, service_role;
