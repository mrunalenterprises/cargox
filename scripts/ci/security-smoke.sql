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
  if to_regprocedure('public.set_partner_availability(boolean,numeric,numeric,numeric)') is null then raise exception 'Missing set_partner_availability RPC'; end if;
  if to_regprocedure('public.get_my_dispatch_offers()') is null then raise exception 'Missing get_my_dispatch_offers RPC'; end if;
  if to_regprocedure('public.respond_to_dispatch_offer(uuid,text)') is null then raise exception 'Missing respond_to_dispatch_offer RPC'; end if;
  if to_regprocedure('public.add_partner_booking_proof(uuid,text,text,text,numeric,numeric)') is null then raise exception 'Missing add_partner_booking_proof RPC'; end if;
  if to_regprocedure('public.advance_partner_booking(uuid,text,numeric,numeric)') is null then raise exception 'Missing advance_partner_booking RPC'; end if;
  if to_regprocedure('public.cancel_customer_booking(uuid,text)') is null then raise exception 'Missing cancel_customer_booking RPC'; end if;
  if to_regprocedure('public.open_customer_support_case(uuid,text,text,text)') is null then raise exception 'Missing open_customer_support_case RPC'; end if;
end
$$;

-- Auth-scoped mutation RPCs must never be callable by anon and must pin search_path.
do $$
declare
  insecure text;
begin
  if has_function_privilege('anon', 'public.set_partner_availability(boolean,numeric,numeric,numeric)', 'EXECUTE') then
    raise exception 'anon can execute set_partner_availability';
  end if;
  if has_function_privilege('anon', 'public.get_my_dispatch_offers()', 'EXECUTE') then
    raise exception 'anon can execute get_my_dispatch_offers';
  end if;
  if has_function_privilege('anon', 'public.respond_to_dispatch_offer(uuid,text)', 'EXECUTE') then
    raise exception 'anon can execute respond_to_dispatch_offer';
  end if;
  if has_function_privilege('anon', 'public.add_partner_booking_proof(uuid,text,text,text,numeric,numeric)', 'EXECUTE') then
    raise exception 'anon can execute add_partner_booking_proof';
  end if;
  if has_function_privilege('anon', 'public.advance_partner_booking(uuid,text,numeric,numeric)', 'EXECUTE') then
    raise exception 'anon can execute advance_partner_booking';
  end if;
  if has_function_privilege('anon', 'public.cancel_customer_booking(uuid,text)', 'EXECUTE') then
    raise exception 'anon can execute cancel_customer_booking';
  end if;
  if has_function_privilege('anon', 'public.open_customer_support_case(uuid,text,text,text)', 'EXECUTE') then
    raise exception 'anon can execute open_customer_support_case';
  end if;

  select string_agg(p.proname, ', ' order by p.proname)
    into insecure
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'set_partner_availability','get_my_dispatch_offers','respond_to_dispatch_offer',
      'add_partner_booking_proof','advance_partner_booking','cancel_customer_booking',
      'open_customer_support_case'
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

select count(*) as public_tables,
       count(*) filter (where c.relrowsecurity) as rls_enabled_tables
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r';
