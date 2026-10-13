-- Enrich Fleet snapshot after mutation RPCs are available.
create or replace function public.loadin_fleet_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_account public.fleet_accounts;
  v_result jsonb;
begin
  v_account := public.require_my_fleet_account();

  select jsonb_build_object(
    'account', to_jsonb(v_account),
    'vehicles', coalesce((select jsonb_agg(jsonb_build_object(
      'id',fv.id,
      'type',fv.vehicle_type,
      'registration_number',fv.registration_number,
      'status',upper(fv.status),
      'driver',coalesce(fd.full_name,'—'),
      'driver_id',fd.id,
      'assignment_id',a.id,
      'docs',case when fv.status='blocked' then 'Blocked' else 'Valid' end
    ) order by fv.created_at desc)
      from public.fleet_vehicles fv
      left join public.fleet_driver_vehicle_assignments a on a.fleet_vehicle_id=fv.id and a.status='active'
      left join public.fleet_drivers fd on fd.id=a.fleet_driver_id
      where fv.fleet_account_id=v_account.id),'[]'::jsonb),
    'drivers', coalesce((select jsonb_agg(jsonb_build_object(
      'id',fd.id,
      'name',fd.full_name,
      'phone',fd.mobile,
      'status',upper(fd.status),
      'partner_user_id',fd.partner_user_id,
      'vehicle',coalesce(fv.registration_number,'—'),
      'vehicle_id',fv.id,
      'assignment_id',a.id
    ) order by fd.created_at desc)
      from public.fleet_drivers fd
      left join public.fleet_driver_vehicle_assignments a on a.fleet_driver_id=fd.id and a.status='active'
      left join public.fleet_vehicles fv on fv.id=a.fleet_vehicle_id
      where fd.fleet_account_id=v_account.id),'[]'::jsonb),
    'bookings', coalesce((select jsonb_agg(jsonb_build_object(
      'id',bx.id,
      'route',coalesce(bx.pickup_address,'')||' → '||coalesce(bx.drop_address,''),
      'status',bx.status,
      'vehicle',coalesce(bx.vehicle_class,'—'),
      'fare',bx.locked_fare,
      'partner_id',bx.partner_id
    ) order by bx.created_at desc)
      from (
        select b.* from public.bookings b
        where exists(select 1 from public.fleet_drivers fd where fd.fleet_account_id=v_account.id and fd.partner_user_id=b.partner_id)
        order by b.created_at desc limit 100
      ) bx),'[]'::jsonb),
    'earnings', coalesce((select jsonb_agg(to_jsonb(es) order by es.period_start desc)
      from public.fleet_earning_snapshots es where es.fleet_account_id=v_account.id),'[]'::jsonb),
    'activity', coalesce((select jsonb_agg(jsonb_build_object(
      'id',al.id,'action',al.action,'entity_type',al.entity_type,'entity_id',al.entity_id,'detail',al.detail,'created_at',al.created_at
    ) order by al.created_at desc)
      from (select * from public.fleet_activity_log where fleet_account_id=v_account.id order by created_at desc limit 50) al),'[]'::jsonb)
  ) into v_result;

  return v_result;
end
$$;

revoke all on function public.loadin_fleet_snapshot() from public, anon;
grant execute on function public.loadin_fleet_snapshot() to authenticated, service_role;
