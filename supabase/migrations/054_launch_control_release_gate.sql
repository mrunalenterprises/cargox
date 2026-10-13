-- LOADIN production launch control: computed go-live gates, manual external checks and auditable release sign-off.

create table if not exists public.production_launch_checks (
  check_key text primary key,
  category text not null,
  label text not null,
  required boolean not null default true,
  status text not null default 'PENDING' check (status in ('PENDING','PASS','FAIL','WAIVED')),
  evidence text,
  metadata jsonb not null default '{}'::jsonb,
  checked_by uuid,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.production_release_signoffs (
  id uuid primary key default gen_random_uuid(),
  release_label text not null,
  commit_sha text,
  city_code text not null,
  status text not null default 'DRAFT' check (status in ('DRAFT','READY','APPROVED','REVOKED')),
  gate_snapshot jsonb not null default '{}'::jsonb,
  notes text,
  created_by uuid not null,
  approved_by uuid,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  revoked_at timestamptz
);

alter table public.production_launch_checks enable row level security;
alter table public.production_release_signoffs enable row level security;

create index if not exists production_release_signoffs_city_created_idx
  on public.production_release_signoffs(city_code,created_at desc);
create index if not exists production_release_signoffs_status_idx
  on public.production_release_signoffs(status,created_at desc);

insert into public.production_launch_checks(check_key,category,label,required)
values
  ('OTP_REAL_DEVICE','EXTERNAL','Real phone OTP verified on physical device',true),
  ('RAZORPAY_LIVE','EXTERNAL','Razorpay live order + signed webhook verified',true),
  ('GOOGLE_MAPS_LIVE','EXTERNAL','Restricted Google Maps key verified on production domain',true),
  ('FCM_LIVE','EXTERNAL','Firebase push verified on real customer and partner device',true),
  ('SECURITY_HEADERS','SECURITY','Production TLS/CSP/HSTS/security headers verified',true),
  ('CUSTOMER_E2E','E2E','Customer booking → payment → completion E2E passed',true),
  ('PARTNER_E2E','E2E','Partner login → online → trip → proof → earnings E2E passed',true),
  ('ADMIN_E2E','E2E','Admin live ops → finance → support/safety E2E passed',true),
  ('FLEET_E2E','E2E','Fleet vehicle → driver → assignment → report E2E passed',true)
on conflict(check_key) do nothing;

create or replace function public.loadin_admin_launch_gate_snapshot(p_city_code text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member public.admin_members;
  v_city public.operating_cities;
  v_requested_city text := nullif(upper(trim(coalesce(p_city_code,''))), '');
  v_super_admin_count integer := 0;
  v_gm_count integer := 0;
  v_accounts_count integer := 0;
  v_service_controls integer := 0;
  v_active_services integer := 0;
  v_vehicle_services integer := 0;
  v_priced_active_services integer := 0;
  v_active_partners integer := 0;
  v_eligible_vehicles integer := 0;
  v_recon_run public.finance_reconciliation_runs;
  v_recon_open_high integer := 0;
  v_critical_sos integer := 0;
  v_urgent_support integer := 0;
  v_manual_required integer := 0;
  v_manual_satisfied integer := 0;
  v_manual jsonb := '[]'::jsonb;
  v_signoffs jsonb := '[]'::jsonb;
  v_checks jsonb;
  v_ready boolean;
begin
  v_member := public.require_loadin_admin(array['SUPER_ADMIN','GM','ACCOUNTS']);

  if v_requested_city is null then
    v_requested_city := coalesce(v_member.city_code,
      case when exists(select 1 from public.operating_cities where code='CSN') then 'CSN' else null end);
  end if;

  if v_requested_city is null then
    select code into v_requested_city from public.operating_cities order by created_at limit 1;
  end if;

  select * into v_city from public.operating_cities where code=v_requested_city;
  if not found then raise exception 'city_not_found' using errcode='P0002'; end if;

  if v_member.role <> 'SUPER_ADMIN' and v_member.city_code is distinct from v_city.code then
    raise exception 'admin_city_scope_denied' using errcode='42501';
  end if;

  select count(*) into v_super_admin_count from public.admin_members where role='SUPER_ADMIN' and is_active=true;
  select count(*) into v_gm_count from public.admin_members where role='GM' and city_code=v_city.code and is_active=true;
  select count(*) into v_accounts_count from public.admin_members where role='ACCOUNTS' and is_active=true and (city_code is null or city_code=v_city.code);

  select
    count(*),
    count(*) filter(where status='ACTIVE'),
    count(*) filter(where status='ACTIVE' and service_code in ('PARCEL_2W','LOADING_VEHICLE'))
  into v_service_controls,v_active_services,v_vehicle_services
  from public.city_service_controls where city_id=v_city.id;

  select count(*) into v_priced_active_services
  from public.city_service_controls c
  where c.city_id=v_city.id and c.status='ACTIVE'
    and exists(
      select 1 from public.pricing_rules p
      where p.city_code=v_city.code
        and p.service_type=c.service_code
        and p.vehicle_class='DEFAULT'
        and p.is_active=true
        and p.base_fare>0
    );

  select count(*) into v_active_partners
  from public.partner_profiles p
  join public.partner_onboarding o on o.partner_id=p.user_id
  where p.city_code=v_city.code and p.status='ACTIVE' and o.onboarding_status='ACTIVE_OFFLINE';

  select count(*) into v_eligible_vehicles
  from public.partner_vehicles pv
  join public.partner_profiles p on p.user_id=pv.partner_id
  where p.city_code=v_city.code and p.status='ACTIVE' and pv.active=true and pv.eligible_for_booking=true;

  select * into v_recon_run
  from public.finance_reconciliation_runs
  where status='COMPLETED'
  order by completed_at desc nulls last,started_at desc
  limit 1;

  select count(*) into v_recon_open_high
  from public.finance_reconciliation_issues i
  where i.status='OPEN' and i.severity in ('P0','P1') and (i.city_code is null or i.city_code=v_city.code);

  select count(*) into v_critical_sos
  from public.sos_incidents s
  left join public.bookings b on b.id=s.booking_id
  where s.severity='CRITICAL' and s.status not in ('RESOLVED','CLOSED')
    and (s.booking_id is null or b.city_code=v_city.code);

  select count(*) into v_urgent_support
  from public.support_cases c
  left join public.bookings b on b.id=c.booking_id
  where c.status not in ('RESOLVED','CLOSED')
    and (c.priority='URGENT' or c.safety_risk=true)
    and (b.city_code=v_city.code);

  select
    count(*) filter(where required),
    count(*) filter(where required and status in ('PASS','WAIVED')),
    coalesce(jsonb_agg(jsonb_build_object(
      'key',check_key,'category',category,'label',label,'required',required,'status',status,
      'evidence',evidence,'checkedBy',checked_by,'checkedAt',checked_at,'updatedAt',updated_at
    ) order by category,check_key),'[]'::jsonb)
  into v_manual_required,v_manual_satisfied,v_manual
  from public.production_launch_checks;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',s.id,'releaseLabel',s.release_label,'commitSha',s.commit_sha,'cityCode',s.city_code,
    'status',s.status,'notes',s.notes,'createdBy',s.created_by,'approvedBy',s.approved_by,
    'createdAt',s.created_at,'approvedAt',s.approved_at,'revokedAt',s.revoked_at
  ) order by s.created_at desc),'[]'::jsonb)
  into v_signoffs
  from (select * from public.production_release_signoffs where city_code=v_city.code order by created_at desc limit 10) s;

  v_checks := jsonb_build_array(
    jsonb_build_object('key','SUPER_ADMIN','label','Active Super Admin','status',case when v_super_admin_count>=1 then 'PASS' else 'FAIL' end,'value',v_super_admin_count,'blocking',true),
    jsonb_build_object('key','CITY_ENABLED','label','Launch city enabled','status',case when v_city.enabled then 'PASS' else 'FAIL' end,'value',v_city.enabled,'blocking',true),
    jsonb_build_object('key','CITY_GM','label','City GM assigned','status',case when v_gm_count>=1 then 'PASS' else 'FAIL' end,'value',v_gm_count,'blocking',true),
    jsonb_build_object('key','ACCOUNTS','label','Accounts staff assigned','status',case when v_accounts_count>=1 then 'PASS' else 'FAIL' end,'value',v_accounts_count,'blocking',true),
    jsonb_build_object('key','SERVICE_CONTROLS','label','All 4 service controls configured','status',case when v_service_controls=4 then 'PASS' else 'FAIL' end,'value',v_service_controls,'blocking',true),
    jsonb_build_object('key','ACTIVE_SERVICE','label','At least one service active','status',case when v_active_services>=1 then 'PASS' else 'FAIL' end,'value',v_active_services,'blocking',true),
    jsonb_build_object('key','ACTIVE_SERVICE_PRICING','label','Every active service has Fare Lock pricing','status',case when v_active_services>=1 and v_priced_active_services=v_active_services then 'PASS' else 'FAIL' end,'value',jsonb_build_object('active',v_active_services,'priced',v_priced_active_services),'blocking',true),
    jsonb_build_object('key','PARTNER_SUPPLY','label','Approved partner supply available','status',case when v_active_partners>=1 then 'PASS' else 'FAIL' end,'value',v_active_partners,'blocking',true),
    jsonb_build_object('key','VEHICLE_SUPPLY','label','Eligible vehicle supply for active vehicle services','status',case when v_vehicle_services=0 or v_eligible_vehicles>=1 then 'PASS' else 'FAIL' end,'value',v_eligible_vehicles,'blocking',true),
    jsonb_build_object('key','RECON_RECENT','label','Finance reconciliation completed within 24h','status',case when v_recon_run.id is not null and v_recon_run.completed_at>=now()-interval '24 hours' then 'PASS' else 'FAIL' end,'value',v_recon_run.completed_at,'blocking',true),
    jsonb_build_object('key','RECON_CLEAN','label','No open P0/P1 finance reconciliation issues','status',case when v_recon_open_high=0 then 'PASS' else 'FAIL' end,'value',v_recon_open_high,'blocking',true),
    jsonb_build_object('key','SAFETY_CLEAR','label','No unresolved critical SOS incidents','status',case when v_critical_sos=0 then 'PASS' else 'FAIL' end,'value',v_critical_sos,'blocking',true),
    jsonb_build_object('key','URGENT_SUPPORT_CLEAR','label','No unresolved urgent/safety support cases','status',case when v_urgent_support=0 then 'PASS' else 'FAIL' end,'value',v_urgent_support,'blocking',true),
    jsonb_build_object('key','MANUAL_EXTERNAL','label','All required external/E2E checks signed off','status',case when v_manual_required>0 and v_manual_satisfied=v_manual_required then 'PASS' else 'FAIL' end,'value',jsonb_build_object('required',v_manual_required,'satisfied',v_manual_satisfied),'blocking',true)
  );

  v_ready := v_super_admin_count>=1
    and v_city.enabled
    and v_gm_count>=1
    and v_accounts_count>=1
    and v_service_controls=4
    and v_active_services>=1
    and v_priced_active_services=v_active_services
    and v_active_partners>=1
    and (v_vehicle_services=0 or v_eligible_vehicles>=1)
    and v_recon_run.id is not null
    and v_recon_run.completed_at>=now()-interval '24 hours'
    and v_recon_open_high=0
    and v_critical_sos=0
    and v_urgent_support=0
    and v_manual_required>0
    and v_manual_satisfied=v_manual_required;

  return jsonb_build_object(
    'releaseReady',v_ready,
    'role',v_member.role,
    'city',jsonb_build_object('code',v_city.code,'name',v_city.name,'enabled',v_city.enabled),
    'checks',v_checks,
    'manualChecks',v_manual,
    'latestReconciliation',case when v_recon_run.id is null then null else jsonb_build_object('id',v_recon_run.id,'completedAt',v_recon_run.completed_at,'summary',v_recon_run.summary) end,
    'signoffs',v_signoffs,
    'generatedAt',now()
  );
end
$$;

create or replace function public.loadin_admin_set_launch_check(
  p_check_key text,
  p_status text,
  p_evidence text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member public.admin_members;
  v_key text := upper(trim(coalesce(p_check_key,'')));
  v_status text := upper(trim(coalesce(p_status,'')));
  v_row public.production_launch_checks;
begin
  v_member := public.require_loadin_admin(array['SUPER_ADMIN']);
  if v_status not in ('PENDING','PASS','FAIL','WAIVED') then raise exception 'invalid_launch_check_status' using errcode='22023'; end if;
  if v_status='WAIVED' and nullif(trim(coalesce(p_evidence,'')),'') is null then raise exception 'waiver_evidence_required' using errcode='22023'; end if;

  select * into v_row from public.production_launch_checks where check_key=v_key for update;
  if not found then raise exception 'launch_check_not_found' using errcode='P0002'; end if;

  update public.production_launch_checks
  set status=v_status,
      evidence=nullif(trim(coalesce(p_evidence,'')),''),
      metadata=coalesce(p_metadata,'{}'::jsonb),
      checked_by=case when v_status='PENDING' then null else v_member.user_id end,
      checked_at=case when v_status='PENDING' then null else now() end,
      updated_at=now()
  where check_key=v_key
  returning * into v_row;

  insert into public.admin_audit_log(actor_user_id,actor_role,action,entity_type,entity_id,after_data,reason)
  values(v_member.user_id,v_member.role,'SET_LAUNCH_CHECK','PRODUCTION_LAUNCH_CHECK',v_key,to_jsonb(v_row),p_evidence);

  return jsonb_build_object('key',v_row.check_key,'status',v_row.status,'evidence',v_row.evidence,'checkedAt',v_row.checked_at);
end
$$;

create or replace function public.loadin_admin_create_release_signoff(
  p_release_label text,
  p_commit_sha text,
  p_city_code text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member public.admin_members;
  v_snapshot jsonb;
  v_row public.production_release_signoffs;
  v_label text := nullif(trim(coalesce(p_release_label,'')),'');
  v_commit text := nullif(trim(coalesce(p_commit_sha,'')),'');
begin
  v_member := public.require_loadin_admin(array['SUPER_ADMIN']);
  if v_label is null then raise exception 'release_label_required' using errcode='22023'; end if;
  if v_commit is not null and v_commit !~ '^[0-9a-fA-F]{7,64}$' then raise exception 'invalid_commit_sha' using errcode='22023'; end if;

  v_snapshot := public.loadin_admin_launch_gate_snapshot(p_city_code);
  insert into public.production_release_signoffs(release_label,commit_sha,city_code,status,gate_snapshot,notes,created_by)
  values(v_label,v_commit,v_snapshot->'city'->>'code',case when coalesce((v_snapshot->>'releaseReady')::boolean,false) then 'READY' else 'DRAFT' end,v_snapshot,nullif(trim(coalesce(p_notes,'')),''),v_member.user_id)
  returning * into v_row;

  insert into public.admin_audit_log(actor_user_id,actor_role,action,entity_type,entity_id,after_data,reason)
  values(v_member.user_id,v_member.role,'CREATE_RELEASE_SIGNOFF','PRODUCTION_RELEASE',v_row.id::text,to_jsonb(v_row),p_notes);

  return jsonb_build_object('id',v_row.id,'status',v_row.status,'releaseLabel',v_row.release_label,'commitSha',v_row.commit_sha,'cityCode',v_row.city_code,'createdAt',v_row.created_at);
end
$$;

create or replace function public.loadin_admin_approve_release_signoff(
  p_signoff_id uuid,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member public.admin_members;
  v_row public.production_release_signoffs;
  v_snapshot jsonb;
begin
  v_member := public.require_loadin_admin(array['SUPER_ADMIN']);
  select * into v_row from public.production_release_signoffs where id=p_signoff_id for update;
  if not found then raise exception 'release_signoff_not_found' using errcode='P0002'; end if;
  if v_row.status='REVOKED' then raise exception 'release_signoff_revoked' using errcode='22023'; end if;

  v_snapshot := public.loadin_admin_launch_gate_snapshot(v_row.city_code);
  if not coalesce((v_snapshot->>'releaseReady')::boolean,false) then
    raise exception 'launch_gate_not_ready' using errcode='22023';
  end if;

  update public.production_release_signoffs
  set status='REVOKED',revoked_at=now()
  where city_code=v_row.city_code and status='APPROVED' and id<>v_row.id;

  update public.production_release_signoffs
  set status='APPROVED',gate_snapshot=v_snapshot,notes=coalesce(nullif(trim(coalesce(p_notes,'')),''),notes),approved_by=v_member.user_id,approved_at=now(),revoked_at=null
  where id=v_row.id
  returning * into v_row;

  insert into public.admin_audit_log(actor_user_id,actor_role,action,entity_type,entity_id,after_data,reason)
  values(v_member.user_id,v_member.role,'APPROVE_PRODUCTION_RELEASE','PRODUCTION_RELEASE',v_row.id::text,to_jsonb(v_row),p_notes);

  return jsonb_build_object('id',v_row.id,'status',v_row.status,'releaseLabel',v_row.release_label,'commitSha',v_row.commit_sha,'approvedAt',v_row.approved_at);
end
$$;

create or replace function public.loadin_admin_revoke_release_signoff(
  p_signoff_id uuid,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member public.admin_members;
  v_row public.production_release_signoffs;
begin
  v_member := public.require_loadin_admin(array['SUPER_ADMIN']);
  update public.production_release_signoffs
  set status='REVOKED',revoked_at=now(),notes=coalesce(nullif(trim(coalesce(p_notes,'')),''),notes)
  where id=p_signoff_id
  returning * into v_row;
  if not found then raise exception 'release_signoff_not_found' using errcode='P0002'; end if;

  insert into public.admin_audit_log(actor_user_id,actor_role,action,entity_type,entity_id,after_data,reason)
  values(v_member.user_id,v_member.role,'REVOKE_PRODUCTION_RELEASE','PRODUCTION_RELEASE',v_row.id::text,to_jsonb(v_row),p_notes);

  return jsonb_build_object('id',v_row.id,'status',v_row.status,'revokedAt',v_row.revoked_at);
end
$$;

revoke all on function public.loadin_admin_launch_gate_snapshot(text) from public,anon;
revoke all on function public.loadin_admin_set_launch_check(text,text,text,jsonb) from public,anon;
revoke all on function public.loadin_admin_create_release_signoff(text,text,text,text) from public,anon;
revoke all on function public.loadin_admin_approve_release_signoff(uuid,text) from public,anon;
revoke all on function public.loadin_admin_revoke_release_signoff(uuid,text) from public,anon;

grant execute on function public.loadin_admin_launch_gate_snapshot(text) to authenticated,service_role;
grant execute on function public.loadin_admin_set_launch_check(text,text,text,jsonb) to authenticated,service_role;
grant execute on function public.loadin_admin_create_release_signoff(text,text,text,text) to authenticated,service_role;
grant execute on function public.loadin_admin_approve_release_signoff(uuid,text) to authenticated,service_role;
grant execute on function public.loadin_admin_revoke_release_signoff(uuid,text) to authenticated,service_role;
