-- LOADIN one-time first Admin login -> SUPER_ADMIN bootstrap.
-- This intentionally mirrors the PIP CAR bootstrap flow: only while no admin
-- membership exists can the currently authenticated Admin login claim the
-- initial SUPER_ADMIN role. The transaction advisory lock prevents races.

create or replace function public.loadin_bootstrap_first_super_admin(
  p_display_name text default 'LOADIN Super Admin'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.admin_members;
  v_name text := coalesce(nullif(trim(coalesce(p_display_name,'')),''),'LOADIN Super Admin');
begin
  if v_uid is null then
    raise exception 'authentication_required' using errcode='42501';
  end if;

  -- Exactly one first-login bootstrap can win, even under concurrent requests.
  perform pg_advisory_xact_lock(hashtext('loadin:first-super-admin-bootstrap')::bigint);

  select * into v_row from public.admin_members where user_id=v_uid;
  if v_row.user_id is not null then
    if v_row.role='SUPER_ADMIN' and v_row.is_active then
      return jsonb_build_object(
        'user_id',v_row.user_id,
        'role',v_row.role,
        'is_active',v_row.is_active,
        'display_name',v_row.display_name,
        'bootstrapped',false,
        'already_super_admin',true
      );
    end if;
    raise exception 'admin_access_already_assigned' using errcode='42501';
  end if;

  -- First Admin login only. After any admin membership exists, automatic
  -- bootstrap is permanently closed and staff must be assigned by SUPER_ADMIN.
  if exists(select 1 from public.admin_members) then
    raise exception 'super_admin_already_initialized' using errcode='42501';
  end if;

  insert into public.admin_members(
    user_id,role,city_code,is_active,display_name,created_by,updated_at
  ) values (
    v_uid,'SUPER_ADMIN',null,true,v_name,v_uid,now()
  )
  returning * into v_row;

  insert into public.admin_audit_log(
    actor_user_id,actor_role,action,entity_type,entity_id,after_data,reason
  ) values (
    v_uid,'FIRST_LOGIN_BOOTSTRAP','BOOTSTRAP_SUPER_ADMIN','ADMIN_MEMBER',
    v_uid::text,to_jsonb(v_row),'First authenticated Admin login bootstrap'
  );

  return jsonb_build_object(
    'user_id',v_row.user_id,
    'role',v_row.role,
    'is_active',v_row.is_active,
    'display_name',v_row.display_name,
    'bootstrapped',true,
    'already_super_admin',false
  );
end
$$;

revoke all on function public.loadin_bootstrap_first_super_admin(text) from public,anon;
grant execute on function public.loadin_bootstrap_first_super_admin(text) to authenticated,service_role;
