-- Security and deployment contract for production-readiness migrations 041-043.
do $$
begin
  if to_regclass('public.partner_online_identity_checks') is null then raise exception 'Missing partner_online_identity_checks'; end if;
  if to_regclass('public.push_device_tokens') is null then raise exception 'Missing push_device_tokens'; end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='partner_balance_events' and column_name='metadata') then raise exception 'Missing partner_balance_events.metadata'; end if;
  if not (select relrowsecurity from pg_class where oid='public.partner_online_identity_checks'::regclass) then raise exception 'partner_online_identity_checks RLS disabled'; end if;
  if not (select relrowsecurity from pg_class where oid='public.push_device_tokens'::regclass) then raise exception 'push_device_tokens RLS disabled'; end if;

  if to_regprocedure('public.register_partner_online_identity_selfie(text)') is null then raise exception 'Missing online identity RPC'; end if;
  if to_regprocedure('public.get_my_partner_compliance_snapshot()') is null then raise exception 'Missing partner compliance RPC'; end if;
  if to_regprocedure('public.request_my_partner_payout(numeric)') is null then raise exception 'Missing payout request RPC'; end if;
  if to_regprocedure('public.loadin_admin_process_partner_payout(uuid,text,text,text)') is null then raise exception 'Missing admin payout process RPC'; end if;
  if to_regprocedure('public.loadin_admin_payout_queue()') is null then raise exception 'Missing admin payout queue RPC'; end if;
  if to_regprocedure('public.loadin_admin_document_review_queue()') is null then raise exception 'Missing document review queue RPC'; end if;
  if to_regprocedure('public.loadin_admin_review_partner_document(text,uuid,boolean,text)') is null then raise exception 'Missing document review mutation RPC'; end if;
  if to_regprocedure('public.upsert_my_push_token(text,text,text)') is null then raise exception 'Missing push token RPC'; end if;
  if to_regprocedure('public.claim_loadin_notifications(integer)') is null then raise exception 'Missing notification claim RPC'; end if;
  if to_regprocedure('public.record_loadin_notification_delivery(uuid,uuid,text,text,text,text)') is null then raise exception 'Missing notification delivery RPC'; end if;
  if to_regprocedure('public.refresh_loadin_document_compliance()') is null then raise exception 'Missing document compliance refresh RPC'; end if;
end
$$;

do $$
begin
  if has_function_privilege('anon','public.register_partner_online_identity_selfie(text)','EXECUTE') then raise exception 'anon can register partner identity'; end if;
  if has_function_privilege('anon','public.get_my_partner_compliance_snapshot()','EXECUTE') then raise exception 'anon can read partner compliance'; end if;
  if has_function_privilege('anon','public.request_my_partner_payout(numeric)','EXECUTE') then raise exception 'anon can request payout'; end if;
  if has_function_privilege('anon','public.loadin_admin_process_partner_payout(uuid,text,text,text)','EXECUTE') then raise exception 'anon can process payout'; end if;
  if has_function_privilege('anon','public.loadin_admin_payout_queue()','EXECUTE') then raise exception 'anon can read payout queue'; end if;
  if has_function_privilege('anon','public.loadin_admin_document_review_queue()','EXECUTE') then raise exception 'anon can read renewal review queue'; end if;
  if has_function_privilege('anon','public.loadin_admin_review_partner_document(text,uuid,boolean,text)','EXECUTE') then raise exception 'anon can review renewal document'; end if;
  if has_function_privilege('anon','public.upsert_my_push_token(text,text,text)','EXECUTE') then raise exception 'anon can register push token'; end if;
  if has_function_privilege('authenticated','public.claim_loadin_notifications(integer)','EXECUTE') then raise exception 'authenticated can claim notification queue'; end if;
  if has_function_privilege('authenticated','public.record_loadin_notification_delivery(uuid,uuid,text,text,text,text)','EXECUTE') then raise exception 'authenticated can forge delivery outcome'; end if;
  if has_function_privilege('authenticated','public.refresh_loadin_document_compliance()','EXECUTE') then raise exception 'authenticated can run global compliance refresh'; end if;
end
$$;

do $$
declare insecure text;
begin
  select string_agg(p.proname,', ' order by p.proname) into insecure
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname in (
      'register_partner_online_identity_selfie','get_my_partner_compliance_snapshot','set_partner_availability',
      'request_my_partner_payout','loadin_admin_process_partner_payout','loadin_admin_payout_queue',
      'loadin_admin_document_review_queue','loadin_admin_review_partner_document',
      'upsert_my_push_token','deactivate_my_push_token','claim_loadin_notifications',
      'record_loadin_notification_delivery','refresh_loadin_document_compliance'
    )
    and (not p.prosecdef or not exists(select 1 from unnest(coalesce(p.proconfig,array[]::text[])) c where c like 'search_path=%'));
  if insecure is not null then raise exception 'Production readiness RPC security invalid: %',insecure; end if;
end
$$;

-- Push token rotation contract: user+device is unique, so a new FCM token replaces the old row.
do $$
begin
  if not exists (
    select 1 from pg_indexes where schemaname='public' and tablename='push_device_tokens' and indexdef like '%UNIQUE%user_id%device_id%'
  ) then raise exception 'Missing user/device push token uniqueness'; end if;
end
$$;

-- Delivery worker must remain service-role only.
do $$
begin
  if not has_function_privilege('service_role','public.claim_loadin_notifications(integer)','EXECUTE') then raise exception 'service_role cannot claim notifications'; end if;
  if not has_function_privilege('service_role','public.record_loadin_notification_delivery(uuid,uuid,text,text,text,text)','EXECUTE') then raise exception 'service_role cannot record notification outcome'; end if;
  if not has_function_privilege('service_role','public.refresh_loadin_document_compliance()','EXECUTE') then raise exception 'service_role cannot refresh compliance'; end if;
end
$$;
