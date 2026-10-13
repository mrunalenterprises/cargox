do $$
begin
  if to_regprocedure('public.save_my_partner_onboarding_profile(text,text,text,text,text,text,text,text,integer,text)') is null then raise exception 'Missing save onboarding profile RPC'; end if;
  if to_regprocedure('public.register_partner_onboarding_selfie(text)') is null then raise exception 'Missing selfie RPC'; end if;
  if to_regprocedure('public.get_my_partner_onboarding_snapshot()') is null then raise exception 'Missing onboarding snapshot RPC'; end if;
  if to_regprocedure('public.submit_my_partner_onboarding_for_review()') is null then raise exception 'Missing submit onboarding RPC'; end if;
  if to_regprocedure('public.loadin_admin_partner_review_queue()') is null then raise exception 'Missing admin review queue RPC'; end if;
  if to_regprocedure('public.loadin_staff_review_partner(uuid,boolean,text)') is null then raise exception 'Missing staff review RPC'; end if;
  if to_regprocedure('public.loadin_admin_finalize_partner(uuid,text,text)') is null then raise exception 'Missing admin finalize RPC'; end if;
end
$$;

do $$
declare insecure text;
begin
  if has_function_privilege('anon','public.save_my_partner_onboarding_profile(text,text,text,text,text,text,text,text,integer,text)','EXECUTE') then raise exception 'anon can save onboarding profile'; end if;
  if has_function_privilege('anon','public.register_partner_onboarding_selfie(text)','EXECUTE') then raise exception 'anon can register selfie'; end if;
  if has_function_privilege('anon','public.get_my_partner_onboarding_snapshot()','EXECUTE') then raise exception 'anon can read onboarding snapshot'; end if;
  if has_function_privilege('anon','public.submit_my_partner_onboarding_for_review()','EXECUTE') then raise exception 'anon can submit onboarding'; end if;
  if has_function_privilege('anon','public.loadin_admin_partner_review_queue()','EXECUTE') then raise exception 'anon can view admin review queue'; end if;
  if has_function_privilege('anon','public.loadin_staff_review_partner(uuid,boolean,text)','EXECUTE') then raise exception 'anon can staff review'; end if;
  if has_function_privilege('anon','public.loadin_admin_finalize_partner(uuid,text,text)','EXECUTE') then raise exception 'anon can finalize partner'; end if;

  select string_agg(p.proname, ', ' order by p.proname) into insecure
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname in ('save_my_partner_onboarding_profile','register_partner_onboarding_selfie','get_my_partner_onboarding_snapshot','submit_my_partner_onboarding_for_review','loadin_admin_partner_review_queue','loadin_staff_review_partner','loadin_admin_finalize_partner')
    and (not p.prosecdef or not exists(select 1 from unnest(coalesce(p.proconfig,array[]::text[])) c where c like 'search_path=%'));
  if insecure is not null then raise exception 'Onboarding RPC security invalid: %', insecure; end if;
end
$$;
