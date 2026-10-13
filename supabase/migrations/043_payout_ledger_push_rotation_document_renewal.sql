-- Close production gaps discovered during payout/notification/compliance wiring.
-- 1) partner_balance_events gains metadata used by payout flows.
-- 2) FCM token rotation is keyed by user+device instead of stale token.
-- 3) Active-partner document renewals receive city-scoped staff/admin review.

alter table public.partner_balance_events
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create or replace function public.upsert_my_push_token(p_token text,p_platform text,p_device_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_platform text := upper(trim(coalesce(p_platform,'')));
  v_token text := trim(coalesce(p_token,''));
  v_device text := trim(coalesce(p_device_id,''));
  v_row public.push_device_tokens;
begin
  if v_uid is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if v_token='' or v_device='' then raise exception 'push_token_and_device_required' using errcode='22023'; end if;
  if v_platform not in ('ANDROID','IOS','WEB') then raise exception 'invalid_push_platform' using errcode='22023'; end if;

  -- FCM rotates tokens. Release a token from any stale device row before assigning it.
  delete from public.push_device_tokens
   where token=v_token and (user_id is distinct from v_uid or device_id is distinct from v_device);

  insert into public.push_device_tokens(user_id,device_id,platform,provider,token,active,last_seen_at,updated_at)
  values(v_uid,v_device,v_platform,'FCM',v_token,true,now(),now())
  on conflict(user_id,device_id) do update set
    platform=excluded.platform,
    provider='FCM',
    token=excluded.token,
    active=true,
    last_seen_at=now(),
    updated_at=now()
  returning * into v_row;

  return jsonb_build_object('id',v_row.id,'device_id',v_row.device_id,'platform',v_row.platform,'active',v_row.active);
end
$$;

create or replace function public.loadin_admin_document_review_queue()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member public.admin_members;
  v_city text;
  v_rows jsonb;
begin
  v_member := public.require_loadin_admin(array['SUPER_ADMIN','GM','FIELD_OFFICER']);
  v_city := case when v_member.role='SUPER_ADMIN' then null else v_member.city_code end;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.updated_at desc),'[]'::jsonb)
  into v_rows
  from (
    select
      'PARTNER'::text as scope,
      pd.id as document_id,
      pd.partner_id,
      pp.full_name as partner_name,
      pp.city_code,
      null::uuid as vehicle_id,
      null::text as registration_number,
      pd.document_type,
      pd.document_number,
      pd.expiry_date,
      pd.status,
      pd.rejection_reason,
      pd.updated_at
    from public.partner_documents pd
    join public.partner_profiles pp on pp.user_id=pd.partner_id
    join public.partner_onboarding po on po.partner_id=pd.partner_id
    where pd.status in ('PENDING','REJECTED','EXPIRED')
      and po.onboarding_status='ACTIVE_OFFLINE'
      and (v_city is null or pp.city_code=v_city)

    union all

    select
      'VEHICLE'::text,
      vd.id,
      pv.partner_id,
      pp.full_name,
      pp.city_code,
      vd.vehicle_id,
      pv.registration_number,
      vd.document_type,
      vd.document_number,
      vd.expiry_date,
      vd.status,
      vd.rejection_reason,
      vd.updated_at
    from public.vehicle_documents vd
    join public.partner_vehicles pv on pv.id=vd.vehicle_id
    join public.partner_profiles pp on pp.user_id=pv.partner_id
    join public.partner_onboarding po on po.partner_id=pv.partner_id
    where vd.status in ('PENDING','REJECTED','EXPIRED')
      and po.onboarding_status='ACTIVE_OFFLINE'
      and (v_city is null or pp.city_code=v_city)
  ) x;

  return jsonb_build_object('role',v_member.role,'cityCode',v_member.city_code,'documents',v_rows);
end
$$;

create or replace function public.loadin_admin_review_partner_document(
  p_scope text,
  p_document_id uuid,
  p_approved boolean,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member public.admin_members;
  v_scope text := upper(trim(coalesce(p_scope,'')));
  v_partner_id uuid;
  v_vehicle_id uuid;
  v_city text;
  v_expiry date;
  v_type text;
  v_status text;
  v_partner_valid integer := 0;
  v_vehicle_valid integer := 0;
  v_ready boolean := false;
begin
  v_member := public.require_loadin_admin(array['SUPER_ADMIN','GM','FIELD_OFFICER']);
  if v_scope not in ('PARTNER','VEHICLE') then raise exception 'invalid_document_scope' using errcode='22023'; end if;

  if v_scope='PARTNER' then
    select pd.partner_id,pp.city_code,pd.expiry_date,pd.document_type,pd.status
      into v_partner_id,v_city,v_expiry,v_type,v_status
    from public.partner_documents pd
    join public.partner_profiles pp on pp.user_id=pd.partner_id
    where pd.id=p_document_id
    for update of pd;
  else
    select pv.partner_id,pp.city_code,vd.expiry_date,vd.document_type,vd.status,vd.vehicle_id
      into v_partner_id,v_city,v_expiry,v_type,v_status,v_vehicle_id
    from public.vehicle_documents vd
    join public.partner_vehicles pv on pv.id=vd.vehicle_id
    join public.partner_profiles pp on pp.user_id=pv.partner_id
    where vd.id=p_document_id
    for update of vd;
  end if;

  if v_partner_id is null then raise exception 'document_not_found' using errcode='P0002'; end if;
  if v_member.role<>'SUPER_ADMIN' and v_member.city_code is distinct from v_city then raise exception 'admin_city_scope_denied' using errcode='42501'; end if;
  if v_status not in ('PENDING','REJECTED','EXPIRED') then raise exception 'document_not_reviewable' using errcode='22023'; end if;
  if p_approved and v_expiry is not null and v_expiry < current_date then raise exception 'cannot_approve_expired_document' using errcode='22023'; end if;

  if v_scope='PARTNER' then
    update public.partner_documents
      set status=case when p_approved then 'APPROVED' else 'REJECTED' end,
          rejection_reason=case when p_approved then null else coalesce(nullif(trim(coalesce(p_notes,'')),''),'Document correction required') end,
          verified_by=v_member.user_id,verified_at=now(),updated_at=now()
    where id=p_document_id;
  else
    update public.vehicle_documents
      set status=case when p_approved then 'APPROVED' else 'REJECTED' end,
          rejection_reason=case when p_approved then null else coalesce(nullif(trim(coalesce(p_notes,'')),''),'Document correction required') end,
          verified_by=v_member.user_id,verified_at=now(),updated_at=now()
    where id=p_document_id;
  end if;

  select count(*) into v_partner_valid
  from public.partner_documents
  where partner_id=v_partner_id
    and document_type in ('AADHAAR_ID','DRIVING_LICENCE','PAN','ADDRESS_PROOF','POLICE_BACKGROUND','BANK_PROOF')
    and status='APPROVED' and (expiry_date is null or expiry_date>=current_date);

  select id into v_vehicle_id
  from public.partner_vehicles where partner_id=v_partner_id order by updated_at desc limit 1;

  if v_vehicle_id is not null then
    select count(*) into v_vehicle_valid
    from public.vehicle_documents
    where vehicle_id=v_vehicle_id
      and document_type in ('RC','INSURANCE','PUC','PERMIT','FITNESS_CERTIFICATE')
      and status='APPROVED' and (expiry_date is null or expiry_date>=current_date);
  end if;

  v_ready := v_partner_valid>=6 and v_vehicle_valid>=5
    and exists(select 1 from public.partner_onboarding where partner_id=v_partner_id and onboarding_status='ACTIVE_OFFLINE' and admin_decision='APPROVED')
    and exists(select 1 from public.partner_profiles where user_id=v_partner_id and status='ACTIVE');

  update public.partner_vehicles
     set eligible_for_booking=v_ready,
         active=case when v_ready then true else active end,
         updated_at=now()
   where partner_id=v_partner_id;

  if v_ready then
    update public.partner_availability
       set online_status=case when online_status='BLOCKED' then 'OFFLINE' else online_status end,updated_at=now()
     where partner_id=v_partner_id;
  else
    update public.partner_availability
       set online_status='BLOCKED',updated_at=now()
     where partner_id=v_partner_id and online_status in ('ONLINE','BUSY');
  end if;

  insert into public.admin_audit_log(actor_user_id,actor_role,action,entity_type,entity_id,after_data,reason)
  values(
    v_member.user_id,v_member.role,
    case when p_approved then 'APPROVE_RENEWAL_DOCUMENT' else 'REJECT_RENEWAL_DOCUMENT' end,
    v_scope||'_DOCUMENT',p_document_id::text,
    jsonb_build_object('partner_id',v_partner_id,'document_type',v_type,'approved',p_approved,'partner_docs_valid',v_partner_valid,'vehicle_docs_valid',v_vehicle_valid,'booking_eligible',v_ready),
    p_notes
  );

  perform public.queue_loadin_notification(
    v_partner_id,null,'DOCUMENT_EXPIRY','NORMAL',
    case when p_approved then 'Document approved' else 'Document correction required' end,
    v_type||case when p_approved then ' is approved.' else ' needs correction.' end,
    jsonb_build_object('scope',v_scope,'document_id',p_document_id,'approved',p_approved,'booking_eligible',v_ready),
    null,false,null
  );

  return jsonb_build_object(
    'document_id',p_document_id,'scope',v_scope,'partner_id',v_partner_id,
    'status',case when p_approved then 'APPROVED' else 'REJECTED' end,
    'partnerDocsValid',v_partner_valid,'vehicleDocsValid',v_vehicle_valid,'bookingEligible',v_ready
  );
end
$$;

revoke all on function public.loadin_admin_document_review_queue() from public, anon;
revoke all on function public.loadin_admin_review_partner_document(text,uuid,boolean,text) from public, anon;

grant execute on function public.loadin_admin_document_review_queue() to authenticated, service_role;
grant execute on function public.loadin_admin_review_partner_document(text,uuid,boolean,text) to authenticated, service_role;
