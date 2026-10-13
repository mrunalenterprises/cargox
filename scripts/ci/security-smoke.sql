do $$
declare
  unsecured text;
begin
  select string_agg(format('%I.%I', n.nspname, c.relname), ', ' order by c.relname)
    into unsecured
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and not c.relrowsecurity;

  if unsecured is not null then
    raise exception 'Public tables without RLS: %', unsecured;
  end if;
end
$$;

-- Core deployment dependencies must exist after the full chain.
do $$
begin
  if to_regclass('public.bookings') is null then raise exception 'Missing public.bookings'; end if;
  if to_regclass('public.partner_vehicles') is null then raise exception 'Missing public.partner_vehicles'; end if;
  if to_regclass('public.partner_finance_accounts') is null then raise exception 'Missing public.partner_finance_accounts'; end if;
  if to_regclass('public.support_cases') is null then raise exception 'Missing public.support_cases'; end if;
  if to_regclass('public.trip_location_points') is null then raise exception 'Missing public.trip_location_points'; end if;
  if to_regclass('public.notifications') is null then raise exception 'Missing public.notifications'; end if;
  if to_regprocedure('public.set_partner_availability(boolean,numeric,numeric,numeric)') is null then raise exception 'Missing set_partner_availability RPC'; end if;
  if to_regprocedure('public.get_my_dispatch_offers()') is null then raise exception 'Missing get_my_dispatch_offers RPC'; end if;
  if to_regprocedure('public.respond_to_dispatch_offer(uuid,text)') is null then raise exception 'Missing respond_to_dispatch_offer RPC'; end if;
  if to_regprocedure('public.add_partner_booking_proof(uuid,text,text,text,numeric,numeric)') is null then raise exception 'Missing add_partner_booking_proof RPC'; end if;
  if to_regprocedure('public.advance_partner_booking(uuid,text,numeric,numeric)') is null then raise exception 'Missing advance_partner_booking RPC'; end if;
  if to_regprocedure('public.cancel_customer_booking(uuid,text)') is null then raise exception 'Missing cancel_customer_booking RPC'; end if;
  if to_regprocedure('public.open_customer_support_case(uuid,text,text,text)') is null then raise exception 'Missing open_customer_support_case RPC'; end if;
  if to_regprocedure('public.publish_partner_location(uuid,numeric,numeric,numeric,numeric,numeric)') is null then raise exception 'Missing publish_partner_location RPC'; end if;
  if to_regprocedure('public.get_booking_tracking_snapshot(uuid)') is null then raise exception 'Missing get_booking_tracking_snapshot RPC'; end if;
  if to_regprocedure('public.mark_notification_opened(uuid)') is null then raise exception 'Missing mark_notification_opened RPC'; end if;
  if to_regprocedure('public.get_my_finance_summary()') is null then raise exception 'Missing get_my_finance_summary RPC'; end if;
  if to_regprocedure('public.loadin_admin_dashboard_snapshot()') is null then raise exception 'Missing loadin_admin_dashboard_snapshot RPC'; end if;
  if to_regprocedure('public.loadin_admin_resolve_support_case(uuid,text)') is null then raise exception 'Missing loadin_admin_resolve_support_case RPC'; end if;
  if to_regprocedure('public.loadin_admin_set_city_service_status(text,text,text,text)') is null then raise exception 'Missing loadin_admin_set_city_service_status RPC'; end if;
  if to_regprocedure('public.loadin_fleet_snapshot()') is null then raise exception 'Missing loadin_fleet_snapshot RPC'; end if;
  if to_regprocedure('public.set_customer_booking_payment_mode(uuid,text)') is null then raise exception 'Missing set_customer_booking_payment_mode RPC'; end if;
end
$$;

-- Auth-scoped RPCs must never be callable by anon and must pin search_path.
do $$
declare
  insecure text;
begin
  if has_function_privilege('anon', 'public.set_partner_availability(boolean,numeric,numeric,numeric)', 'EXECUTE') then raise exception 'anon can execute set_partner_availability'; end if;
  if has_function_privilege('anon', 'public.get_my_dispatch_offers()', 'EXECUTE') then raise exception 'anon can execute get_my_dispatch_offers'; end if;
  if has_function_privilege('anon', 'public.respond_to_dispatch_offer(uuid,text)', 'EXECUTE') then raise exception 'anon can execute respond_to_dispatch_offer'; end if;
  if has_function_privilege('anon', 'public.add_partner_booking_proof(uuid,text,text,text,numeric,numeric)', 'EXECUTE') then raise exception 'anon can execute add_partner_booking_proof'; end if;
  if has_function_privilege('anon', 'public.advance_partner_booking(uuid,text,numeric,numeric)', 'EXECUTE') then raise exception 'anon can execute advance_partner_booking'; end if;
  if has_function_privilege('anon', 'public.cancel_customer_booking(uuid,text)', 'EXECUTE') then raise exception 'anon can execute cancel_customer_booking'; end if;
  if has_function_privilege('anon', 'public.open_customer_support_case(uuid,text,text,text)', 'EXECUTE') then raise exception 'anon can execute open_customer_support_case'; end if;
  if has_function_privilege('anon', 'public.publish_partner_location(uuid,numeric,numeric,numeric,numeric,numeric)', 'EXECUTE') then raise exception 'anon can execute publish_partner_location'; end if;
  if has_function_privilege('anon', 'public.get_booking_tracking_snapshot(uuid)', 'EXECUTE') then raise exception 'anon can execute get_booking_tracking_snapshot'; end if;
  if has_function_privilege('anon', 'public.mark_notification_opened(uuid)', 'EXECUTE') then raise exception 'anon can execute mark_notification_opened'; end if;
  if has_function_privilege('anon', 'public.get_my_finance_summary()', 'EXECUTE') then raise exception 'anon can execute get_my_finance_summary'; end if;
  if has_function_privilege('anon', 'public.loadin_admin_dashboard_snapshot()', 'EXECUTE') then raise exception 'anon can execute admin dashboard'; end if;
  if has_function_privilege('anon', 'public.loadin_admin_resolve_support_case(uuid,text)', 'EXECUTE') then raise exception 'anon can resolve support'; end if;
  if has_function_privilege('anon', 'public.loadin_admin_set_city_service_status(text,text,text,text)', 'EXECUTE') then raise exception 'anon can mutate city service'; end if;
  if has_function_privilege('anon', 'public.loadin_fleet_snapshot()', 'EXECUTE') then raise exception 'anon can execute fleet snapshot'; end if;
  if has_function_privilege('anon', 'public.set_customer_booking_payment_mode(uuid,text)', 'EXECUTE') then raise exception 'anon can set payment mode'; end if;

  select string_agg(p.proname, ', ' order by p.proname)
    into insecure
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'set_partner_availability','get_my_dispatch_offers','respond_to_dispatch_offer',
      'add_partner_booking_proof','advance_partner_booking','cancel_customer_booking',
      'open_customer_support_case','publish_partner_location','get_booking_tracking_snapshot',
      'mark_notification_opened','get_my_finance_summary','require_loadin_admin',
      'loadin_admin_dashboard_snapshot','loadin_admin_resolve_support_case',
      'loadin_admin_set_city_service_status','loadin_fleet_snapshot','set_customer_booking_payment_mode'
    )
    and (
      not p.prosecdef
      or not exists (
        select 1 from unnest(coalesce(p.proconfig, array[]::text[])) c
        where c like 'search_path=%'
      )
    );

  if insecure is not null then
    raise exception 'Auth-scoped RPC security configuration invalid: %', insecure;
  end if;
end
$$;

-- Internal trigger helpers must not be directly executable by browser roles.
do $$
begin
  if has_function_privilege('authenticated', 'public.enqueue_initial_booking_dispatch()', 'EXECUTE') then raise exception 'authenticated can execute internal dispatch trigger'; end if;
  if has_function_privilege('authenticated', 'public.notify_booking_status_change()', 'EXECUTE') then raise exception 'authenticated can execute internal status trigger'; end if;
  if has_function_privilege('authenticated', 'public.notify_booking_proof_added()', 'EXECUTE') then raise exception 'authenticated can execute internal proof trigger'; end if;
  if has_function_privilege('authenticated', 'public.finalize_loadin_booking_finance()', 'EXECUTE') then raise exception 'authenticated can execute internal finance trigger'; end if;
  if has_function_privilege('authenticated', 'public.queue_loadin_notification(uuid,uuid,text,text,text,text,jsonb,text,boolean,timestamptz)', 'EXECUTE') then raise exception 'authenticated can execute internal notification helper'; end if;
end
$$;

select count(*) as public_tables,
       count(*) filter (where c.relrowsecurity) as rls_enabled_tables
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r';