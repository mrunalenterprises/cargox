-- Security contract for live map/admin GPS surfaces.
do $$
begin
  if to_regprocedure('public.loadin_admin_live_map_snapshot()') is null then raise exception 'Missing admin live map RPC'; end if;
  if has_function_privilege('anon','public.loadin_admin_live_map_snapshot()','EXECUTE') then raise exception 'anon can read admin live map'; end if;
  if not has_function_privilege('authenticated','public.loadin_admin_live_map_snapshot()','EXECUTE') then raise exception 'authenticated portal cannot call admin live map RPC'; end if;
  if not (select relrowsecurity from pg_class where oid='public.trip_location_points'::regclass) then raise exception 'trip_location_points RLS disabled'; end if;
  if not (select relrowsecurity from pg_class where oid='public.partner_availability'::regclass) then raise exception 'partner_availability RLS disabled'; end if;
end
$$;

do $$
declare insecure text;
begin
  select string_agg(p.proname,', ') into insecure
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='loadin_admin_live_map_snapshot'
    and (not p.prosecdef or not exists(select 1 from unnest(coalesce(p.proconfig,array[]::text[])) c where c like 'search_path=%'));
  if insecure is not null then raise exception 'Admin live map RPC security invalid: %',insecure; end if;
end
$$;
