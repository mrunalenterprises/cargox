-- Authenticated device-level push controls for Customer/Partner web apps.
-- Token creation/rotation remains handled by upsert_my_push_token from migration 043.

create or replace function public.get_my_push_devices()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_devices jsonb;
begin
  if v_uid is null then
    raise exception 'authentication_required' using errcode='42501';
  end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.last_seen_at desc),'[]'::jsonb)
    into v_devices
  from (
    select id, device_id, platform, provider, active, last_seen_at, created_at, updated_at
    from public.push_device_tokens
    where user_id=v_uid
    order by last_seen_at desc
  ) x;

  return jsonb_build_object('user_id',v_uid,'devices',v_devices);
end
$$;

create or replace function public.deactivate_my_push_device(p_device_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_device text := trim(coalesce(p_device_id,''));
  v_count integer := 0;
begin
  if v_uid is null then
    raise exception 'authentication_required' using errcode='42501';
  end if;
  if v_device='' then
    raise exception 'device_id_required' using errcode='22023';
  end if;

  update public.push_device_tokens
     set active=false, updated_at=now()
   where user_id=v_uid and device_id=v_device and active=true;
  get diagnostics v_count = row_count;

  return jsonb_build_object('device_id',v_device,'deactivated',v_count>0);
end
$$;

revoke all on function public.get_my_push_devices() from public, anon;
revoke all on function public.deactivate_my_push_device(text) from public, anon;

grant execute on function public.get_my_push_devices() to authenticated, service_role;
grant execute on function public.deactivate_my_push_device(text) to authenticated, service_role;
