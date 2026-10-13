-- City-scoped live operations map snapshot for authenticated LOADIN admins.
create or replace function public.loadin_admin_live_map_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member public.admin_members;
  v_city text;
begin
  v_member := public.require_loadin_admin(null);
  v_city := case when v_member.role='SUPER_ADMIN' then null else v_member.city_code end;

  return jsonb_build_object(
    'role',v_member.role,
    'cityCode',v_member.city_code,
    'trips',coalesce((
      select jsonb_agg(jsonb_build_object(
        'booking_id',b.id,
        'service_code',b.service_code,
        'status',b.status,
        'pickup_address',b.pickup_address,
        'drop_address',b.drop_address,
        'partner_id',b.partner_id,
        'fare_locked',b.locked_fare,
        'latitude',lp.latitude,
        'longitude',lp.longitude,
        'accuracy_m',lp.accuracy_m,
        'captured_at',lp.captured_at
      ) order by b.updated_at desc)
      from public.bookings b
      left join lateral (
        select p.latitude,p.longitude,p.accuracy_m,p.captured_at
        from public.trip_location_points p
        where p.booking_id=b.id
        order by p.captured_at desc
        limit 1
      ) lp on true
      where b.status in ('SEARCHING','ASSIGNED','PARTNER_ARRIVING','AT_PICKUP','IN_PROGRESS')
        and (v_city is null or b.city_code=v_city)
    ),'[]'::jsonb),
    'partners',coalesce((
      select jsonb_agg(jsonb_build_object(
        'partner_id',pp.user_id,
        'name',coalesce(pp.full_name,'Partner'),
        'online_status',pa.online_status,
        'latitude',pa.latitude,
        'longitude',pa.longitude,
        'heading',pa.heading,
        'last_seen_at',pa.last_seen_at
      ) order by pa.last_seen_at desc nulls last)
      from public.partner_availability pa
      join public.partner_profiles pp on pp.user_id=pa.partner_id
      where pa.online_status in ('ONLINE','BUSY')
        and (v_city is null or pp.city_code=v_city)
    ),'[]'::jsonb),
    'alerts',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',sc.id,
        'booking_id',sc.booking_id,
        'priority',case sc.priority when 'URGENT' then 'P0' when 'HIGH' then 'P1' when 'NORMAL' then 'P2' else 'P3' end,
        'category',sc.category,
        'status',sc.status
      ) order by sc.created_at desc)
      from public.support_cases sc
      join public.bookings b on b.id=sc.booking_id
      where sc.status not in ('RESOLVED','CLOSED')
        and sc.priority in ('URGENT','HIGH')
        and (v_city is null or b.city_code=v_city)
    ),'[]'::jsonb)
  );
end
$$;

revoke all on function public.loadin_admin_live_map_snapshot() from public, anon;
grant execute on function public.loadin_admin_live_map_snapshot() to authenticated, service_role;
