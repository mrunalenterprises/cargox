-- Payment orchestration security contract.
do $$
begin
  if to_regclass('public.payment_provider_events') is null then raise exception 'Missing payment_provider_events'; end if;
  if not (select relrowsecurity from pg_class where oid='public.payment_provider_events'::regclass) then raise exception 'payment_provider_events RLS disabled'; end if;
  if to_regprocedure('public.prepare_my_online_payment(uuid)') is null then raise exception 'Missing customer payment prepare RPC'; end if;
  if to_regprocedure('public.bind_loadin_provider_order(uuid,text,text,jsonb)') is null then raise exception 'Missing provider order binding RPC'; end if;
  if to_regprocedure('public.record_loadin_payment_event(text,text,text,text,text,numeric,boolean,jsonb)') is null then raise exception 'Missing payment event RPC'; end if;
end
$$;

do $$
begin
  if has_function_privilege('anon','public.prepare_my_online_payment(uuid)','EXECUTE') then raise exception 'anon can prepare customer payment'; end if;
  if has_function_privilege('anon','public.bind_loadin_provider_order(uuid,text,text,jsonb)','EXECUTE') then raise exception 'anon can bind provider order'; end if;
  if has_function_privilege('authenticated','public.bind_loadin_provider_order(uuid,text,text,jsonb)','EXECUTE') then raise exception 'authenticated can bind provider order'; end if;
  if has_function_privilege('anon','public.record_loadin_payment_event(text,text,text,text,text,numeric,boolean,jsonb)','EXECUTE') then raise exception 'anon can record payment event'; end if;
  if has_function_privilege('authenticated','public.record_loadin_payment_event(text,text,text,text,text,numeric,boolean,jsonb)','EXECUTE') then raise exception 'authenticated can forge payment event'; end if;
  if not has_function_privilege('authenticated','public.prepare_my_online_payment(uuid)','EXECUTE') then raise exception 'authenticated cannot prepare own payment'; end if;
  if not has_function_privilege('service_role','public.bind_loadin_provider_order(uuid,text,text,jsonb)','EXECUTE') then raise exception 'service role cannot bind provider order'; end if;
  if not has_function_privilege('service_role','public.record_loadin_payment_event(text,text,text,text,text,numeric,boolean,jsonb)','EXECUTE') then raise exception 'service role cannot record payment event'; end if;
end
$$;

do $$
declare insecure text;
begin
  select string_agg(p.proname,', ' order by p.proname) into insecure
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname in ('prepare_my_online_payment','bind_loadin_provider_order','record_loadin_payment_event')
    and (not p.prosecdef or not exists(select 1 from unnest(coalesce(p.proconfig,array[]::text[])) c where c like 'search_path=%'));
  if insecure is not null then raise exception 'Payment RPC security invalid: %',insecure; end if;
end
$$;
