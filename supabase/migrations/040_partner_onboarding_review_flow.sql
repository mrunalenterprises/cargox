-- End-to-end partner onboarding: partner profile/vehicle/plan/selfie submission,
-- staff review, Admin approval, and activation as Active Offline.

alter table public.partner_onboarding
  add column if not exists selfie_storage_path text,
  add column if not exists selected_plan text check (selected_plan in ('SUBSCRIPTION','COMMISSION')),
  add column if not exists submitted_at timestamptz,
  add column if not exists staff_review_notes text;

create or replace function public.save_my_partner_onboarding_profile(
  p_full_name text,
  p_mobile text,
  p_email text,
  p_city_code text,
  p_vehicle_category text,
  p_registration_number text,
  p_make text default null,
  p_model text default null,
  p_capacity_kg integer default null,
  p_plan text default 'COMMISSION'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_plan text := upper(trim(coalesce(p_plan,'COMMISSION')));
  v_vehicle public.partner_vehicles;
begin
  if v_uid is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if nullif(trim(coalesce(p_full_name,'')),'') is null then raise exception 'full_name_required' using errcode='22023'; end if;
  if nullif(trim(coalesce(p_city_code,'')),'') is null then raise exception 'city_required' using errcode='22023'; end if;
  if nullif(trim(coalesce(p_vehicle_category,'')),'') is null then raise exception 'vehicle_category_required' using errcode='22023'; end if;
  if nullif(trim(coalesce(p_registration_number,'')),'') is null then raise exception 'registration_number_required' using errcode='22023'; end if;
  if v_plan not in ('SUBSCRIPTION','COMMISSION') then raise exception 'invalid_partner_plan' using errcode='22023'; end if;

  insert into public.partner_profiles(user_id,full_name,mobile,email,city_code,status,updated_at)
  values(v_uid,trim(p_full_name),nullif(trim(coalesce(p_mobile,'')),''),nullif(trim(coalesce(p_email,'')),''),upper(trim(p_city_code)),'PENDING',now())
  on conflict(user_id) do update set
    full_name=excluded.full_name,mobile=excluded.mobile,email=excluded.email,city_code=excluded.city_code,updated_at=now();

  insert into public.partner_onboarding(partner_id,profile,selected_plan,onboarding_status,updated_at)
  values(v_uid,jsonb_build_object('full_name',trim(p_full_name),'mobile',nullif(trim(coalesce(p_mobile,'')),''),'email',nullif(trim(coalesce(p_email,'')),''),'city_code',upper(trim(p_city_code))),v_plan,'DRAFT',now())
  on conflict(partner_id) do update set
    profile=excluded.profile,selected_plan=excluded.selected_plan,
    onboarding_status=case when public.partner_onboarding.onboarding_status in ('ACTIVE_OFFLINE','SUSPENDED') then public.partner_onboarding.onboarding_status else 'DRAFT' end,
    rejection_reason=null,updated_at=now();

  select * into v_vehicle from public.partner_vehicles
  where partner_id=v_uid and registration_number=upper(trim(p_registration_number))
  limit 1;

  if not found then
    insert into public.partner_vehicles(partner_id,vehicle_category,registration_number,make,model,capacity_kg,active,eligible_for_booking,updated_at)
    values(v_uid,upper(trim(p_vehicle_category)),upper(trim(p_registration_number)),nullif(trim(coalesce(p_make,'')),''),nullif(trim(coalesce(p_model,'')),''),p_capacity_kg,false,false,now())
    returning * into v_vehicle;
  else
    update public.partner_vehicles
    set vehicle_category=upper(trim(p_vehicle_category)),make=nullif(trim(coalesce(p_make,'')),''),model=nullif(trim(coalesce(p_model,'')),''),capacity_kg=p_capacity_kg,updated_at=now()
    where id=v_vehicle.id returning * into v_vehicle;
  end if;

  insert into public.partner_finance_accounts(partner_id,plan,commission_balance,earnings_balance,pending_payout,minimum_cash_booking_balance,updated_at)
  values(v_uid,v_plan,0,0,0,0,now())
  on conflict(partner_id) do update set plan=excluded.plan,updated_at=now();

  return jsonb_build_object('partner_id',v_uid,'vehicle_id',v_vehicle.id,'plan',v_plan,'status','DRAFT');
end
$$;

create or replace function public.register_partner_onboarding_selfie(p_storage_path text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if p_storage_path is null or split_part(p_storage_path,'/',1) <> v_uid::text then
    raise exception 'invalid_storage_path' using errcode='42501';
  end if;

  insert into public.partner_onboarding(partner_id,selfie_storage_path,selfie_verified,onboarding_status,updated_at)
  values(v_uid,p_storage_path,false,'DRAFT',now())
  on conflict(partner_id) do update set
    selfie_storage_path=excluded.selfie_storage_path,selfie_verified=false,
    onboarding_status=case when public.partner_onboarding.onboarding_status in ('ACTIVE_OFFLINE','SUSPENDED') then public.partner_onboarding.onboarding_status else 'DRAFT' end,
    updated_at=now();

  return jsonb_build_object('partner_id',v_uid,'selfie_uploaded',true,'selfie_verified',false);
end
$$;

create or replace function public.get_my_partner_onboarding_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.partner_profiles;
  v_onboarding public.partner_onboarding;
  v_vehicle public.partner_vehicles;
  v_finance public.partner_finance_accounts;
  v_personal_count integer;
  v_vehicle_count integer;
  v_bank_count integer;
begin
  if v_uid is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select * into v_profile from public.partner_profiles where user_id=v_uid;
  select * into v_onboarding from public.partner_onboarding where partner_id=v_uid;
  select * into v_vehicle from public.partner_vehicles where partner_id=v_uid order by updated_at desc limit 1;
  select * into v_finance from public.partner_finance_accounts where partner_id=v_uid;

  select count(*) into v_personal_count from public.partner_documents
   where partner_id=v_uid and document_type in ('AADHAAR_ID','DRIVING_LICENCE','PAN','ADDRESS_PROOF','POLICE_BACKGROUND') and storage_path is not null;
  select count(*) into v_bank_count from public.partner_documents
   where partner_id=v_uid and document_type='BANK_PROOF' and storage_path is not null;
  select count(*) into v_vehicle_count from public.vehicle_documents
   where vehicle_id=v_vehicle.id and document_type in ('RC','INSURANCE','PUC','PERMIT','FITNESS_CERTIFICATE') and storage_path is not null;

  return jsonb_build_object(
    'partner_id',v_uid,
    'status',coalesce(v_onboarding.onboarding_status,'DRAFT'),
    'profile',coalesce(to_jsonb(v_profile),'{}'::jsonb),
    'vehicle',coalesce(to_jsonb(v_vehicle),'{}'::jsonb),
    'plan',coalesce(v_onboarding.selected_plan,v_finance.plan,'COMMISSION'),
    'checks',jsonb_build_object(
      'profile',v_profile.user_id is not null and nullif(trim(coalesce(v_profile.full_name,'')),'') is not null and nullif(trim(coalesce(v_profile.city_code,'')),'') is not null,
      'personalDocs',v_personal_count >= 5,
      'selfie',v_onboarding.selfie_storage_path is not null,
      'vehicle',v_vehicle.id is not null,
      'vehicleDocs',v_vehicle_count >= 5,
      'bank',v_bank_count >= 1,
      'pricing',v_finance.partner_id is not null
    ),
    'counts',jsonb_build_object('personalDocs',v_personal_count,'vehicleDocs',v_vehicle_count,'bank',v_bank_count),
    'staffApproved',coalesce(v_onboarding.staff_approved,false),
    'adminDecision',v_onboarding.admin_decision,
    'rejectionReason',v_onboarding.rejection_reason,
    'submittedAt',v_onboarding.submitted_at
  );
end
$$;

create or replace function public.submit_my_partner_onboarding_for_review()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_snapshot jsonb;
  v_checks jsonb;
  v_ready boolean;
begin
  if v_uid is null then raise exception 'authentication_required' using errcode='42501'; end if;
  v_snapshot := public.get_my_partner_onboarding_snapshot();
  v_checks := v_snapshot->'checks';
  v_ready := coalesce((v_checks->>'profile')::boolean,false)
    and coalesce((v_checks->>'personalDocs')::boolean,false)
    and coalesce((v_checks->>'selfie')::boolean,false)
    and coalesce((v_checks->>'vehicle')::boolean,false)
    and coalesce((v_checks->>'vehicleDocs')::boolean,false)
    and coalesce((v_checks->>'bank')::boolean,false)
    and coalesce((v_checks->>'pricing')::boolean,false);

  if not v_ready then raise exception 'onboarding_incomplete' using errcode='22023'; end if;

  update public.partner_onboarding
  set onboarding_status='STAFF_REVIEW',staff_approved=false,staff_approved_by=null,staff_approved_at=null,
      admin_decision=null,admin_decision_by=null,admin_decision_at=null,rejection_reason=null,submitted_at=now(),updated_at=now()
  where partner_id=v_uid;

  return public.get_my_partner_onboarding_snapshot();
end
$$;

create or replace function public.loadin_admin_partner_review_queue()
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

  select coalesce(jsonb_agg(jsonb_build_object(
    'partner_id',x.partner_id,'name',x.full_name,'city_code',x.city_code,'status',x.onboarding_status,
    'staff_approved',x.staff_approved,'admin_decision',x.admin_decision,'selected_plan',x.selected_plan,
    'selfie_uploaded',x.selfie_storage_path is not null,'personal_docs',x.personal_docs,'vehicle_docs',x.vehicle_docs,
    'bank_ready',x.bank_ready,'vehicle_id',x.vehicle_id,'vehicle_category',x.vehicle_category,'registration_number',x.registration_number,
    'submitted_at',x.submitted_at,'rejection_reason',x.rejection_reason
  ) order by x.submitted_at nulls last, x.partner_id),'[]'::jsonb)
  into v_rows
  from (
    select po.partner_id,pp.full_name,pp.city_code,po.onboarding_status,po.staff_approved,po.admin_decision,po.selected_plan,
      po.selfie_storage_path,po.submitted_at,po.rejection_reason,pv.id vehicle_id,pv.vehicle_category,pv.registration_number,
      (select count(*) from public.partner_documents pd where pd.partner_id=po.partner_id and pd.document_type in ('AADHAAR_ID','DRIVING_LICENCE','PAN','ADDRESS_PROOF','POLICE_BACKGROUND') and pd.storage_path is not null) personal_docs,
      (select count(*) from public.partner_documents pd where pd.partner_id=po.partner_id and pd.document_type='BANK_PROOF' and pd.storage_path is not null) > 0 bank_ready,
      (select count(*) from public.vehicle_documents vd where vd.vehicle_id=pv.id and vd.document_type in ('RC','INSURANCE','PUC','PERMIT','FITNESS_CERTIFICATE') and vd.storage_path is not null) vehicle_docs
    from public.partner_onboarding po
    join public.partner_profiles pp on pp.user_id=po.partner_id
    left join lateral (select * from public.partner_vehicles v where v.partner_id=po.partner_id order by v.updated_at desc limit 1) pv on true
    where po.onboarding_status in ('STAFF_REVIEW','ADMIN_REVIEW','REJECTED')
      and (v_city is null or pp.city_code=v_city)
  ) x;
  return v_rows;
end
$$;

create or replace function public.loadin_staff_review_partner(
  p_partner_id uuid,
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
  v_partner public.partner_profiles;
  v_onboarding public.partner_onboarding;
begin
  v_member := public.require_loadin_admin(array['SUPER_ADMIN','GM','FIELD_OFFICER']);
  select * into v_partner from public.partner_profiles where user_id=p_partner_id;
  if not found then raise exception 'partner_not_found' using errcode='P0002'; end if;
  if v_member.role <> 'SUPER_ADMIN' and v_member.city_code is distinct from v_partner.city_code then raise exception 'admin_city_scope_denied' using errcode='42501'; end if;

  select * into v_onboarding from public.partner_onboarding where partner_id=p_partner_id for update;
  if not found or v_onboarding.onboarding_status <> 'STAFF_REVIEW' then raise exception 'partner_not_in_staff_review' using errcode='22023'; end if;

  update public.partner_onboarding
  set staff_approved=p_approved,staff_approved_by=v_member.user_id,staff_approved_at=now(),staff_review_notes=p_notes,
      onboarding_status=case when p_approved then 'ADMIN_REVIEW' else 'DRAFT' end,
      rejection_reason=case when p_approved then null else coalesce(nullif(trim(coalesce(p_notes,'')),''),'Staff requested correction') end,
      updated_at=now()
  where partner_id=p_partner_id returning * into v_onboarding;

  insert into public.admin_audit_log(actor_user_id,actor_role,action,entity_type,entity_id,after_data,reason)
  values(v_member.user_id,v_member.role,case when p_approved then 'STAFF_APPROVE_PARTNER' else 'STAFF_RETURN_PARTNER' end,'PARTNER',p_partner_id::text,to_jsonb(v_onboarding),p_notes);

  return jsonb_build_object('partner_id',p_partner_id,'status',v_onboarding.onboarding_status,'staff_approved',v_onboarding.staff_approved);
end
$$;

create or replace function public.loadin_admin_finalize_partner(
  p_partner_id uuid,
  p_decision text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member public.admin_members;
  v_partner public.partner_profiles;
  v_onboarding public.partner_onboarding;
  v_decision text := upper(trim(coalesce(p_decision,'')));
begin
  v_member := public.require_loadin_admin(array['SUPER_ADMIN','GM']);
  if v_decision not in ('APPROVED','REJECTED') then raise exception 'invalid_admin_decision' using errcode='22023'; end if;
  select * into v_partner from public.partner_profiles where user_id=p_partner_id;
  if not found then raise exception 'partner_not_found' using errcode='P0002'; end if;
  if v_member.role <> 'SUPER_ADMIN' and v_member.city_code is distinct from v_partner.city_code then raise exception 'admin_city_scope_denied' using errcode='42501'; end if;

  select * into v_onboarding from public.partner_onboarding where partner_id=p_partner_id for update;
  if not found then raise exception 'onboarding_not_found' using errcode='P0002'; end if;
  if v_decision='APPROVED' and (v_onboarding.onboarding_status <> 'ADMIN_REVIEW' or not v_onboarding.staff_approved) then
    raise exception 'staff_approval_required' using errcode='22023';
  end if;

  update public.partner_onboarding
  set admin_decision=v_decision,admin_decision_by=v_member.user_id,admin_decision_at=now(),
      selfie_verified=case when v_decision='APPROVED' then true else selfie_verified end,
      bank_verified=case when v_decision='APPROVED' then true else bank_verified end,
      onboarding_status=case when v_decision='APPROVED' then 'ACTIVE_OFFLINE' else 'REJECTED' end,
      rejection_reason=case when v_decision='APPROVED' then null else coalesce(nullif(trim(coalesce(p_notes,'')),''),'Admin rejected onboarding') end,
      updated_at=now()
  where partner_id=p_partner_id returning * into v_onboarding;

  if v_decision='APPROVED' then
    update public.partner_profiles set status='ACTIVE',updated_at=now() where user_id=p_partner_id;
    update public.partner_documents set status='APPROVED',rejection_reason=null,verified_by=v_member.user_id,verified_at=now(),updated_at=now() where partner_id=p_partner_id;
    update public.partner_vehicles set active=true,eligible_for_booking=true,updated_at=now() where partner_id=p_partner_id;
    update public.vehicle_documents vd set status='APPROVED',rejection_reason=null,verified_by=v_member.user_id,verified_at=now(),updated_at=now()
      where exists(select 1 from public.partner_vehicles pv where pv.id=vd.vehicle_id and pv.partner_id=p_partner_id);
    insert into public.partner_availability(partner_id,online_status,last_seen_at,updated_at)
    values(p_partner_id,'OFFLINE',now(),now())
    on conflict(partner_id) do update set online_status='OFFLINE',updated_at=now();
  else
    update public.partner_profiles set status='REJECTED',updated_at=now() where user_id=p_partner_id;
    update public.partner_vehicles set active=false,eligible_for_booking=false,updated_at=now() where partner_id=p_partner_id;
  end if;

  insert into public.admin_audit_log(actor_user_id,actor_role,action,entity_type,entity_id,after_data,reason)
  values(v_member.user_id,v_member.role,'ADMIN_'||v_decision||'_PARTNER','PARTNER',p_partner_id::text,to_jsonb(v_onboarding),p_notes);

  return jsonb_build_object('partner_id',p_partner_id,'decision',v_decision,'status',v_onboarding.onboarding_status);
end
$$;

revoke all on function public.save_my_partner_onboarding_profile(text,text,text,text,text,text,text,text,integer,text) from public, anon;
revoke all on function public.register_partner_onboarding_selfie(text) from public, anon;
revoke all on function public.get_my_partner_onboarding_snapshot() from public, anon;
revoke all on function public.submit_my_partner_onboarding_for_review() from public, anon;
revoke all on function public.loadin_admin_partner_review_queue() from public, anon;
revoke all on function public.loadin_staff_review_partner(uuid,boolean,text) from public, anon;
revoke all on function public.loadin_admin_finalize_partner(uuid,text,text) from public, anon;

grant execute on function public.save_my_partner_onboarding_profile(text,text,text,text,text,text,text,text,integer,text) to authenticated, service_role;
grant execute on function public.register_partner_onboarding_selfie(text) to authenticated, service_role;
grant execute on function public.get_my_partner_onboarding_snapshot() to authenticated, service_role;
grant execute on function public.submit_my_partner_onboarding_for_review() to authenticated, service_role;
grant execute on function public.loadin_admin_partner_review_queue() to authenticated, service_role;
grant execute on function public.loadin_staff_review_partner(uuid,boolean,text) to authenticated, service_role;
grant execute on function public.loadin_admin_finalize_partner(uuid,text,text) to authenticated, service_role;
