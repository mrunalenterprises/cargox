-- LOADIN secure staff management and first Super Admin bootstrap.

alter table public.admin_members
  add column if not exists display_name text,
  add column if not exists created_by uuid,
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.loadin_admin_staff_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member public.admin_members;
  v_staff jsonb;
  v_audit jsonb;
begin
  v_member := public.require_loadin_admin(array['SUPER_ADMIN','GM']);

  select coalesce(jsonb_agg(jsonb_build_object(
    'user_id',m.user_id,
    'display_name',coalesce(m.display_name,'Staff Member'),
    'role',m.role,
    'city_code',m.city_code,
    'is_active',m.is_active,
    'created_at',m.created_at,
    'updated_at',m.updated_at,
    'can_edit',case
      when v_member.role='SUPER_ADMIN' then true
      when v_member.role='GM' and m.role='FIELD_OFFICER' and m.city_code is not distinct from v_member.city_code then true
      else false
    end
  ) order by m.is_active desc,m.role,m.created_at),'[]'::jsonb)
  into v_staff
  from public.admin_members m
  where v_member.role='SUPER_ADMIN'
     or m.user_id=v_member.user_id
     or (m.city_code is not distinct from v_member.city_code and m.role in ('GM','FIELD_OFFICER'));

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',a.id,
    'actor_user_id',a.actor_user_id,
    'actor_name',coalesce(am.display_name,a.actor_user_id::text),
    'actor_role',a.actor_role,
    'action',a.action,
    'entity_type',a.entity_type,
    'entity_id',a.entity_id,
    'reason',a.reason,
    'created_at',a.created_at
  ) order by a.created_at desc),'[]'::jsonb)
  into v_audit
  from (
    select x.* from public.admin_audit_log x
    left join public.admin_members actor on actor.user_id=x.actor_user_id
    where v_member.role='SUPER_ADMIN'
       or x.actor_user_id=v_member.user_id
       or actor.city_code is not distinct from v_member.city_code
    order by x.created_at desc
    limit 100
  ) a
  left join public.admin_members am on am.user_id=a.actor_user_id;

  return jsonb_build_object(
    'role',v_member.role,
    'cityCode',v_member.city_code,
    'staff',v_staff,
    'audit',v_audit
  );
end
$$;

create or replace function public.loadin_admin_upsert_staff(
  p_user_id uuid,
  p_role text,
  p_city_code text default null,
  p_display_name text default null,
  p_is_active boolean default true,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor public.admin_members;
  v_before public.admin_members;
  v_after public.admin_members;
  v_role text := upper(trim(coalesce(p_role,'')));
  v_city text := nullif(upper(trim(coalesce(p_city_code,''))), '');
  v_name text := nullif(trim(coalesce(p_display_name,'')), '');
begin
  v_actor := public.require_loadin_admin(array['SUPER_ADMIN','GM']);
  if p_user_id is null then raise exception 'staff_user_required' using errcode='22023'; end if;
  if v_role not in ('SUPER_ADMIN','GM','ACCOUNTS','FIELD_OFFICER') then raise exception 'invalid_staff_role' using errcode='22023'; end if;
  if not exists(select 1 from auth.users where id=p_user_id) then raise exception 'staff_auth_user_not_found' using errcode='P0002'; end if;

  if v_role <> 'SUPER_ADMIN' then
    if v_city is null then raise exception 'staff_city_required' using errcode='22023'; end if;
    if not exists(select 1 from public.operating_cities where code=v_city) then raise exception 'staff_city_not_found' using errcode='P0002'; end if;
  else
    v_city := null;
  end if;

  select * into v_before from public.admin_members where user_id=p_user_id;

  if v_actor.role='GM' then
    if v_role <> 'FIELD_OFFICER' or v_city is distinct from v_actor.city_code then
      raise exception 'gm_may_manage_only_field_officers_in_own_city' using errcode='42501';
    end if;
    if found and (v_before.role <> 'FIELD_OFFICER' or v_before.city_code is distinct from v_actor.city_code) then
      raise exception 'gm_target_scope_denied' using errcode='42501';
    end if;
  end if;

  if p_user_id=v_actor.user_id and (not coalesce(p_is_active,true) or v_role is distinct from v_actor.role) then
    raise exception 'cannot_disable_or_change_own_admin_role' using errcode='42501';
  end if;

  insert into public.admin_members(user_id,role,city_code,is_active,display_name,created_by,updated_at)
  values(p_user_id,v_role,v_city,coalesce(p_is_active,true),v_name,v_actor.user_id,now())
  on conflict(user_id) do update set
    role=excluded.role,
    city_code=excluded.city_code,
    is_active=excluded.is_active,
    display_name=coalesce(excluded.display_name,public.admin_members.display_name),
    updated_at=now()
  returning * into v_after;

  insert into public.admin_audit_log(actor_user_id,actor_role,action,entity_type,entity_id,before_data,after_data,reason)
  values(v_actor.user_id,v_actor.role,'UPSERT_STAFF_MEMBER','ADMIN_MEMBER',p_user_id::text,
    case when v_before.user_id is null then null else to_jsonb(v_before) end,to_jsonb(v_after),nullif(trim(coalesce(p_reason,'')),''));

  return jsonb_build_object(
    'user_id',v_after.user_id,
    'display_name',v_after.display_name,
    'role',v_after.role,
    'city_code',v_after.city_code,
    'is_active',v_after.is_active,
    'updated_at',v_after.updated_at
  );
end
$$;

create or replace function public.loadin_bootstrap_super_admin(
  p_user_id uuid,
  p_display_name text default 'LOADIN Super Admin',
  p_reason text default 'Production bootstrap'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.admin_members;
begin
  if p_user_id is null then raise exception 'super_admin_user_required' using errcode='22023'; end if;
  if not exists(select 1 from auth.users where id=p_user_id) then raise exception 'super_admin_auth_user_not_found' using errcode='P0002'; end if;

  insert into public.admin_members(user_id,role,city_code,is_active,display_name,created_by,updated_at)
  values(p_user_id,'SUPER_ADMIN',null,true,nullif(trim(coalesce(p_display_name,'')),''),p_user_id,now())
  on conflict(user_id) do update set
    role='SUPER_ADMIN',city_code=null,is_active=true,
    display_name=coalesce(nullif(trim(coalesce(excluded.display_name,'')),''),public.admin_members.display_name),
    updated_at=now()
  returning * into v_row;

  insert into public.admin_audit_log(actor_user_id,actor_role,action,entity_type,entity_id,after_data,reason)
  values(p_user_id,'SERVICE_ROLE_BOOTSTRAP','BOOTSTRAP_SUPER_ADMIN','ADMIN_MEMBER',p_user_id::text,to_jsonb(v_row),p_reason);

  return jsonb_build_object('user_id',v_row.user_id,'role',v_row.role,'is_active',v_row.is_active,'display_name',v_row.display_name);
end
$$;

revoke all on function public.loadin_admin_staff_snapshot() from public,anon;
revoke all on function public.loadin_admin_upsert_staff(uuid,text,text,text,boolean,text) from public,anon;
revoke all on function public.loadin_bootstrap_super_admin(uuid,text,text) from public,anon,authenticated;

grant execute on function public.loadin_admin_staff_snapshot() to authenticated,service_role;
grant execute on function public.loadin_admin_upsert_staff(uuid,text,text,text,boolean,text) to authenticated,service_role;
grant execute on function public.loadin_bootstrap_super_admin(uuid,text,text) to service_role;
