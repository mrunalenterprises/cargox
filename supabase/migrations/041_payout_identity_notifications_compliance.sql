-- Production readiness batch: fresh partner identity before Go Online, document-expiry enforcement,
-- partner payout requests, and provider-neutral push notification delivery primitives.

create table if not exists public.partner_online_identity_checks (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null,
  storage_path text not null,
  status text not null default 'CAPTURED' check (status in ('CAPTURED','VERIFIED','REJECTED','CONSUMED')),
  captured_at timestamptz not null default now(),
  verified_at timestamptz,
  consumed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.partner_online_identity_checks enable row level security;
create policy "partner_read_own_online_identity_checks" on public.partner_online_identity_checks
for select using (auth.uid() = partner_id);
create index if not exists partner_online_identity_recent_idx
on public.partner_online_identity_checks(partner_id, captured_at desc);

create table if not exists public.push_device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  device_id text not null,
  platform text not null check (platform in ('ANDROID','IOS','WEB')),
  provider text not null default 'FCM' check (provider in ('FCM')),
  token text not null unique,
  active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, device_id)
);

alter table public.push_device_tokens enable row level security;
create policy "user_read_own_push_tokens" on public.push_device_tokens
for select using (auth.uid() = user_id);
create index if not exists push_device_tokens_user_active_idx
on public.push_device_tokens(user_id, active, last_seen_at desc);

alter table public.notifications
  add column if not exists claimed_at timestamptz,
  add column if not exists claim_token uuid;

create index if not exists notifications_dispatch_claim_idx
on public.notifications(status, scheduled_for, claimed_at)
where status = 'QUEUED';

create unique index if not exists document_expiry_alert_dedupe_idx
on public.document_expiry_alerts(
  coalesce(partner_id,'00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(vehicle_id,'00000000-0000-0000-0000-000000000000'::uuid),
  document_scope, document_type, expiry_date, alert_level
);

create or replace function public.register_partner_online_identity_selfie(p_storage_path text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_onboarding public.partner_onboarding;
  v_id uuid;
begin
  if v_uid is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if p_storage_path is null or split_part(p_storage_path,'/',1) <> v_uid::text then
    raise exception 'invalid_storage_path' using errcode='42501';
  end if;

  select * into v_onboarding from public.partner_onboarding where partner_id=v_uid;
  if not found or v_onboarding.onboarding_status <> 'ACTIVE_OFFLINE' or v_onboarding.admin_decision <> 'APPROVED' then
    raise exception 'partner_not_approved' using errcode='42501';
  end if;

  insert into public.partner_online_identity_checks(partner_id,storage_path,status,captured_at)
  values(v_uid,p_storage_path,'CAPTURED',now()) returning id into v_id;

  return jsonb_build_object('id',v_id,'partner_id',v_uid,'status','CAPTURED','valid_for_minutes',15,'captured_at',now());
end
$$;

create or replace function public.get_my_partner_compliance_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_onboarding public.partner_onboarding;
  v_profile public.partner_profiles;
  v_vehicle public.partner_vehicles;
  v_finance public.partner_finance_accounts;
  v_partner_valid integer := 0;
  v_vehicle_valid integer := 0;
  v_expiring_30 integer := 0;
  v_expired integer := 0;
  v_identity_ready boolean := false;
begin
  if v_uid is null then raise exception 'authentication_required' using errcode='42501'; end if;

  select * into v_profile from public.partner_profiles where user_id=v_uid;
  select * into v_onboarding from public.partner_onboarding where partner_id=v_uid;
  select * into v_vehicle from public.partner_vehicles where partner_id=v_uid order by updated_at desc limit 1;
  select * into v_finance from public.partner_finance_accounts where partner_id=v_uid;

  select count(*) into v_partner_valid
  from public.partner_documents
  where partner_id=v_uid
    and document_type in ('AADHAAR_ID','DRIVING_LICENCE','PAN','ADDRESS_PROOF','POLICE_BACKGROUND','BANK_PROOF')
    and status='APPROVED'
    and (expiry_date is null or expiry_date >= current_date);

  if v_vehicle.id is not null then
    select count(*) into v_vehicle_valid
    from public.vehicle_documents
    where vehicle_id=v_vehicle.id
      and document_type in ('RC','INSURANCE','PUC','PERMIT','FITNESS_CERTIFICATE')
      and status='APPROVED'
      and (expiry_date is null or expiry_date >= current_date);
  end if;

  select count(*) into v_expiring_30 from (
    select expiry_date from public.partner_documents where partner_id=v_uid and status='APPROVED' and expiry_date between current_date and current_date+30
    union all
    select vd.expiry_date from public.vehicle_documents vd join public.partner_vehicles pv on pv.id=vd.vehicle_id
      where pv.partner_id=v_uid and vd.status='APPROVED' and vd.expiry_date between current_date and current_date+30
  ) x;

  select count(*) into v_expired from (
    select expiry_date from public.partner_documents where partner_id=v_uid and expiry_date < current_date
    union all
    select vd.expiry_date from public.vehicle_documents vd join public.partner_vehicles pv on pv.id=vd.vehicle_id
      where pv.partner_id=v_uid and vd.expiry_date < current_date
  ) x;

  select exists(
    select 1 from public.partner_online_identity_checks c
    where c.partner_id=v_uid and c.status in ('CAPTURED','VERIFIED') and c.consumed_at is null
      and c.captured_at >= now()-interval '15 minutes'
  ) into v_identity_ready;

  return jsonb_build_object(
    'partner_id',v_uid,
    'approved',coalesce(v_profile.status='ACTIVE',false) and coalesce(v_onboarding.onboarding_status='ACTIVE_OFFLINE',false),
    'vehicleEligible',coalesce(v_vehicle.active and v_vehicle.eligible_for_booking,false),
    'partnerDocsValid',v_partner_valid >= 6,
    'vehicleDocsValid',v_vehicle_valid >= 5,
    'validPartnerDocs',v_partner_valid,
    'validVehicleDocs',v_vehicle_valid,
    'expiringWithin30Days',v_expiring_30,
    'expiredDocuments',v_expired,
    'identityReady',v_identity_ready,
    'plan',v_finance.plan,
    'subscriptionValidUntil',v_finance.subscription_valid_until,
    'canGoOnline',coalesce(v_profile.status='ACTIVE',false)
      and coalesce(v_onboarding.onboarding_status='ACTIVE_OFFLINE',false)
      and coalesce(v_vehicle.active and v_vehicle.eligible_for_booking,false)
      and v_partner_valid >= 6 and v_vehicle_valid >= 5 and v_identity_ready
      and (v_finance.plan <> 'SUBSCRIPTION' or v_finance.subscription_valid_until >= now())
  );
end
$$;

-- Replaces the earlier availability RPC with production compliance and fresh-selfie enforcement.
create or replace function public.set_partner_availability(
  p_online boolean,
  p_latitude numeric default null,
  p_longitude numeric default null,
  p_heading numeric default null
)
returns public.partner_availability
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.partner_availability;
  v_existing text := 'OFFLINE';
  v_compliance jsonb;
  v_identity_id uuid;
begin
  if v_uid is null then raise exception 'authentication_required' using errcode='42501'; end if;

  select online_status into v_existing from public.partner_availability where partner_id=v_uid;
  v_existing := coalesce(v_existing,'OFFLINE');

  if p_online and v_existing not in ('ONLINE','BUSY') then
    v_compliance := public.get_my_partner_compliance_snapshot();
    if not coalesce((v_compliance->>'approved')::boolean,false) then raise exception 'partner_not_approved' using errcode='42501'; end if;
    if not coalesce((v_compliance->>'vehicleEligible')::boolean,false) then raise exception 'vehicle_not_eligible' using errcode='42501'; end if;
    if not coalesce((v_compliance->>'partnerDocsValid')::boolean,false) then raise exception 'partner_documents_invalid_or_expired' using errcode='42501'; end if;
    if not coalesce((v_compliance->>'vehicleDocsValid')::boolean,false) then raise exception 'vehicle_documents_invalid_or_expired' using errcode='42501'; end if;
    if (v_compliance->>'plan')='SUBSCRIPTION' and ((v_compliance->>'subscriptionValidUntil') is null or (v_compliance->>'subscriptionValidUntil')::timestamptz < now()) then
      raise exception 'subscription_not_active' using errcode='42501';
    end if;

    select id into v_identity_id
    from public.partner_online_identity_checks
    where partner_id=v_uid and status in ('CAPTURED','VERIFIED') and consumed_at is null
      and captured_at >= now()-interval '15 minutes'
    order by captured_at desc limit 1 for update;
    if v_identity_id is null then raise exception 'fresh_identity_selfie_required' using errcode='42501'; end if;

    update public.partner_online_identity_checks
      set status='CONSUMED',consumed_at=now() where id=v_identity_id;
  end if;

  insert into public.partner_availability(partner_id,online_status,latitude,longitude,heading,last_seen_at,updated_at)
  values(v_uid,case when p_online then 'ONLINE' else 'OFFLINE' end,p_latitude,p_longitude,p_heading,now(),now())
  on conflict(partner_id) do update set
    online_status=case when p_online then 'ONLINE' else 'OFFLINE' end,
    latitude=coalesce(excluded.latitude,public.partner_availability.latitude),
    longitude=coalesce(excluded.longitude,public.partner_availability.longitude),
    heading=coalesce(excluded.heading,public.partner_availability.heading),
    last_seen_at=now(),updated_at=now()
  returning * into v_row;
  return v_row;
end
$$;

create or replace function public.request_my_partner_payout(p_amount numeric)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_amount numeric(14,2) := round(coalesce(p_amount,0),2);
  v_account public.partner_finance_accounts;
  v_request public.partner_payout_requests;
begin
  if v_uid is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if v_amount < 500 then raise exception 'minimum_payout_500' using errcode='22023'; end if;

  select * into v_account from public.partner_finance_accounts where partner_id=v_uid for update;
  if not found then raise exception 'finance_account_missing' using errcode='P0002'; end if;
  if v_account.earnings_balance < v_amount then raise exception 'insufficient_earnings_balance' using errcode='22023'; end if;

  insert into public.partner_payout_requests(partner_id,amount,status,metadata)
  values(v_uid,v_amount,'REQUESTED',jsonb_build_object('source','PARTNER_APP')) returning * into v_request;

  update public.partner_finance_accounts
  set earnings_balance=earnings_balance-v_amount,pending_payout=pending_payout+v_amount,updated_at=now()
  where partner_id=v_uid;

  insert into public.partner_finance_ledger(partner_id,entry_type,amount,balance_bucket,reference,metadata)
  values(v_uid,'PAYOUT_DEBIT',-v_amount,'EARNINGS','PAYOUT_REQUEST_'||v_request.id::text,jsonb_build_object('payout_request_id',v_request.id));

  insert into public.partner_balance_events(partner_id,bucket,direction,amount,reason,metadata)
  values(v_uid,'EARNINGS','DEBIT',v_amount,'PAYOUT_REQUEST',jsonb_build_object('payout_request_id',v_request.id));

  return jsonb_build_object('id',v_request.id,'status',v_request.status,'amount',v_amount,'requested_at',v_request.requested_at);
end
$$;

create or replace function public.loadin_admin_process_partner_payout(
  p_request_id uuid,
  p_action text,
  p_provider_reference text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member public.admin_members;
  v_req public.partner_payout_requests;
  v_partner public.partner_profiles;
  v_action text := upper(trim(coalesce(p_action,'')));
begin
  v_member := public.require_loadin_admin(array['SUPER_ADMIN','GM','ACCOUNTS']);
  if v_action not in ('APPROVE','PROCESS','PAID','REJECT') then raise exception 'invalid_payout_action' using errcode='22023'; end if;

  select * into v_req from public.partner_payout_requests where id=p_request_id for update;
  if not found then raise exception 'payout_request_not_found' using errcode='P0002'; end if;
  select * into v_partner from public.partner_profiles where user_id=v_req.partner_id;
  if v_member.role <> 'SUPER_ADMIN' and v_member.city_code is distinct from v_partner.city_code then raise exception 'admin_city_scope_denied' using errcode='42501'; end if;
  if v_req.status in ('PAID','REJECTED','CANCELLED') then raise exception 'payout_request_terminal' using errcode='22023'; end if;

  if v_action='APPROVE' then
    update public.partner_payout_requests set status='APPROVED',metadata=metadata||jsonb_build_object('admin_notes',p_notes) where id=p_request_id returning * into v_req;
  elsif v_action='PROCESS' then
    update public.partner_payout_requests set status='PROCESSING',metadata=metadata||jsonb_build_object('admin_notes',p_notes) where id=p_request_id returning * into v_req;
  elsif v_action='PAID' then
    update public.partner_payout_requests set status='PAID',bank_reference=nullif(trim(coalesce(p_provider_reference,'')),''),processed_at=now(),metadata=metadata||jsonb_build_object('admin_notes',p_notes) where id=p_request_id returning * into v_req;
    update public.partner_finance_accounts set pending_payout=greatest(0,pending_payout-v_req.amount),updated_at=now() where partner_id=v_req.partner_id;
    insert into public.payout_reconciliations(payout_request_id,partner_id,expected_amount,settled_amount,difference,status,provider_reference,reconciled_by,reconciled_at,metadata)
    values(v_req.id,v_req.partner_id,v_req.amount,v_req.amount,0,'MATCHED',p_provider_reference,v_member.user_id,now(),jsonb_build_object('source','ADMIN_PAYOUT'));
  else
    update public.partner_payout_requests set status='REJECTED',processed_at=now(),metadata=metadata||jsonb_build_object('admin_notes',p_notes) where id=p_request_id returning * into v_req;
    update public.partner_finance_accounts set earnings_balance=earnings_balance+v_req.amount,pending_payout=greatest(0,pending_payout-v_req.amount),updated_at=now() where partner_id=v_req.partner_id;
    insert into public.partner_finance_ledger(partner_id,entry_type,amount,balance_bucket,reference,metadata)
    values(v_req.partner_id,'PAYOUT_REVERSAL',v_req.amount,'EARNINGS','PAYOUT_REJECT_'||v_req.id::text,jsonb_build_object('payout_request_id',v_req.id));
    insert into public.partner_balance_events(partner_id,bucket,direction,amount,reason,metadata)
    values(v_req.partner_id,'EARNINGS','CREDIT',v_req.amount,'PAYOUT_REJECTED',jsonb_build_object('payout_request_id',v_req.id));
  end if;

  insert into public.admin_audit_log(actor_user_id,actor_role,action,entity_type,entity_id,after_data,reason)
  values(v_member.user_id,v_member.role,'PAYOUT_'||v_action,'PAYOUT_REQUEST',p_request_id::text,to_jsonb(v_req),p_notes);

  return jsonb_build_object('id',v_req.id,'partner_id',v_req.partner_id,'amount',v_req.amount,'status',v_req.status,'processed_at',v_req.processed_at);
end
$$;

create or replace function public.upsert_my_push_token(p_token text,p_platform text,p_device_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_platform text := upper(trim(coalesce(p_platform,'')));
  v_row public.push_device_tokens;
begin
  if v_uid is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if nullif(trim(coalesce(p_token,'')),'') is null or nullif(trim(coalesce(p_device_id,'')),'') is null then raise exception 'push_token_and_device_required' using errcode='22023'; end if;
  if v_platform not in ('ANDROID','IOS','WEB') then raise exception 'invalid_push_platform' using errcode='22023'; end if;

  insert into public.push_device_tokens(user_id,device_id,platform,provider,token,active,last_seen_at,updated_at)
  values(v_uid,trim(p_device_id),v_platform,'FCM',trim(p_token),true,now(),now())
  on conflict(token) do update set user_id=v_uid,device_id=excluded.device_id,platform=excluded.platform,active=true,last_seen_at=now(),updated_at=now()
  returning * into v_row;

  return jsonb_build_object('id',v_row.id,'device_id',v_row.device_id,'platform',v_row.platform,'active',v_row.active);
end
$$;

create or replace function public.deactivate_my_push_token(p_token text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'authentication_required' using errcode='42501'; end if;
  update public.push_device_tokens set active=false,updated_at=now() where user_id=v_uid and token=p_token;
  return found;
end
$$;

-- Service worker integration: claim due notifications, then report FCM/provider outcome.
create or replace function public.claim_loadin_notifications(p_limit integer default 100)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_claim uuid := gen_random_uuid();
  v_rows jsonb;
begin
  with due as (
    select n.id from public.notifications n
    where n.status='QUEUED' and coalesce(n.scheduled_for,now()) <= now()
      and (n.expires_at is null or n.expires_at > now())
      and (n.claimed_at is null or n.claimed_at < now()-interval '5 minutes')
    order by n.priority desc,n.created_at
    limit greatest(1,least(coalesce(p_limit,100),500))
    for update skip locked
  ), claimed as (
    update public.notifications n set claimed_at=now(),claim_token=v_claim
    from due where n.id=due.id returning n.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'notification',to_jsonb(c),
    'tokens',coalesce((select jsonb_agg(jsonb_build_object('token',t.token,'platform',t.platform,'device_id',t.device_id)) from public.push_device_tokens t where t.user_id=c.user_id and t.active),'[]'::jsonb)
  )),'[]'::jsonb) into v_rows from claimed c;
  return jsonb_build_object('claim_token',v_claim,'items',v_rows);
end
$$;

create or replace function public.record_loadin_notification_delivery(
  p_notification_id uuid,
  p_claim_token uuid,
  p_outcome text,
  p_provider_message_id text default null,
  p_error_code text default null,
  p_error_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_outcome text := upper(trim(coalesce(p_outcome,'')));
  v_attempt integer;
  v_status text;
begin
  if v_outcome not in ('SENT','DELIVERED','FAILED','RETRY') then raise exception 'invalid_delivery_outcome' using errcode='22023'; end if;
  if not exists(select 1 from public.notifications where id=p_notification_id and claim_token=p_claim_token) then raise exception 'notification_claim_mismatch' using errcode='42501'; end if;
  select coalesce(max(attempt_no),0)+1 into v_attempt from public.notification_delivery_attempts where notification_id=p_notification_id;
  insert into public.notification_delivery_attempts(notification_id,provider,provider_message_id,attempt_no,outcome,error_code,error_message)
  values(p_notification_id,'FCM',p_provider_message_id,v_attempt,v_outcome,p_error_code,p_error_message);
  v_status := case v_outcome when 'SENT' then 'SENT' when 'DELIVERED' then 'DELIVERED' when 'FAILED' then 'FAILED' else 'QUEUED' end;
  update public.notifications set status=v_status,sent_at=case when v_outcome in ('SENT','DELIVERED') then coalesce(sent_at,now()) else sent_at end,
    delivered_at=case when v_outcome='DELIVERED' then coalesce(delivered_at,now()) else delivered_at end,
    claimed_at=null,claim_token=null where id=p_notification_id;
  return jsonb_build_object('id',p_notification_id,'status',v_status,'attempt',v_attempt);
end
$$;

-- Called by a trusted scheduled worker. Go Online also performs a real-time expiry check, so
-- a missed schedule cannot let an expired partner/vehicle return online.
create or replace function public.refresh_loadin_document_compliance()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r record;
  v_alerts integer := 0;
  v_expired integer := 0;
  v_level text;
begin
  for r in
    select 'PARTNER'::text scope,pd.partner_id,null::uuid vehicle_id,pd.id document_id,pd.document_type,pd.expiry_date
    from public.partner_documents pd where pd.expiry_date is not null and pd.status in ('APPROVED','EXPIRED') and pd.expiry_date <= current_date+30
    union all
    select 'VEHICLE',pv.partner_id,vd.vehicle_id,vd.id,vd.document_type,vd.expiry_date
    from public.vehicle_documents vd join public.partner_vehicles pv on pv.id=vd.vehicle_id
    where vd.expiry_date is not null and vd.status in ('APPROVED','EXPIRED') and vd.expiry_date <= current_date+30
  loop
    v_level := case when r.expiry_date < current_date then 'EXPIRED' when r.expiry_date <= current_date+7 then '7_DAY' else '30_DAY' end;
    insert into public.document_expiry_alerts(partner_id,vehicle_id,document_scope,document_type,expiry_date,alert_level)
    values(r.partner_id,r.vehicle_id,r.scope,r.document_type,r.expiry_date,v_level)
    on conflict do nothing;
    if found then
      v_alerts := v_alerts+1;
      perform public.queue_loadin_notification(r.partner_id,null,'DOCUMENT_EXPIRY',case when v_level='EXPIRED' then 'CRITICAL' else 'HIGH' end,
        case when v_level='EXPIRED' then 'Document expired' else 'Document expiry reminder' end,
        r.document_type||' • '||r.expiry_date::text,jsonb_build_object('scope',r.scope,'document_type',r.document_type,'expiry_date',r.expiry_date,'alert_level',v_level),null,true,null);
    end if;

    if r.expiry_date < current_date then
      v_expired := v_expired+1;
      if r.scope='PARTNER' then update public.partner_documents set status='EXPIRED',updated_at=now() where id=r.document_id and status<>'EXPIRED';
      else update public.vehicle_documents set status='EXPIRED',updated_at=now() where id=r.document_id and status<>'EXPIRED'; end if;
      update public.partner_vehicles set eligible_for_booking=false,updated_at=now() where partner_id=r.partner_id;
      update public.partner_availability set online_status='BLOCKED',updated_at=now() where partner_id=r.partner_id and online_status in ('ONLINE','BUSY');
    end if;
  end loop;
  return jsonb_build_object('alertsCreated',v_alerts,'expiredProcessed',v_expired,'refreshedAt',now());
end
$$;

revoke all on function public.register_partner_online_identity_selfie(text) from public, anon;
revoke all on function public.get_my_partner_compliance_snapshot() from public, anon;
revoke all on function public.request_my_partner_payout(numeric) from public, anon;
revoke all on function public.loadin_admin_process_partner_payout(uuid,text,text,text) from public, anon;
revoke all on function public.upsert_my_push_token(text,text,text) from public, anon;
revoke all on function public.deactivate_my_push_token(text) from public, anon;
revoke all on function public.claim_loadin_notifications(integer) from public, anon, authenticated;
revoke all on function public.record_loadin_notification_delivery(uuid,uuid,text,text,text,text) from public, anon, authenticated;
revoke all on function public.refresh_loadin_document_compliance() from public, anon, authenticated;

grant execute on function public.register_partner_online_identity_selfie(text) to authenticated, service_role;
grant execute on function public.get_my_partner_compliance_snapshot() to authenticated, service_role;
grant execute on function public.request_my_partner_payout(numeric) to authenticated, service_role;
grant execute on function public.loadin_admin_process_partner_payout(uuid,text,text,text) to authenticated, service_role;
grant execute on function public.upsert_my_push_token(text,text,text) to authenticated, service_role;
grant execute on function public.deactivate_my_push_token(text) to authenticated, service_role;
grant execute on function public.claim_loadin_notifications(integer) to service_role;
grant execute on function public.record_loadin_notification_delivery(uuid,uuid,text,text,text,text) to service_role;
grant execute on function public.refresh_loadin_document_compliance() to service_role;