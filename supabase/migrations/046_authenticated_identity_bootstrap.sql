-- Authenticated identity/bootstrap helpers for production portal login.
-- Phone OTP itself is handled by Supabase Auth and the configured SMS provider.

create or replace function public.ensure_my_customer_profile(
  p_full_name text default null,
  p_mobile text default null,
  p_city_code text default 'CSN'
)
returns public.customer_profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.customer_profiles;
begin
  if v_uid is null then
    raise exception 'authentication_required' using errcode='42501';
  end if;

  insert into public.customer_profiles(user_id, full_name, mobile, city_code, updated_at)
  values (
    v_uid,
    nullif(trim(coalesce(p_full_name,'')),''),
    nullif(trim(coalesce(p_mobile,'')),''),
    nullif(trim(coalesce(p_city_code,'')),'') ,
    now()
  )
  on conflict (user_id) do update set
    full_name = coalesce(excluded.full_name, public.customer_profiles.full_name),
    mobile = coalesce(excluded.mobile, public.customer_profiles.mobile),
    city_code = coalesce(excluded.city_code, public.customer_profiles.city_code),
    updated_at = now()
  returning * into v_row;

  return v_row;
end
$$;

create or replace function public.get_my_loadin_identity()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_customer public.customer_profiles;
  v_partner public.partner_profiles;
  v_admin public.admin_members;
  v_fleet public.fleet_accounts;
begin
  if v_uid is null then
    raise exception 'authentication_required' using errcode='42501';
  end if;

  select * into v_customer from public.customer_profiles where user_id=v_uid;
  select * into v_partner from public.partner_profiles where user_id=v_uid;
  select * into v_admin from public.admin_members where user_id=v_uid and is_active=true;
  select * into v_fleet from public.fleet_accounts where owner_user_id=v_uid and status='active' order by created_at limit 1;

  return jsonb_build_object(
    'user_id', v_uid,
    'customer', case when v_customer.user_id is null then null else jsonb_build_object(
      'exists',true,'full_name',v_customer.full_name,'mobile',v_customer.mobile,'city_code',v_customer.city_code
    ) end,
    'partner', case when v_partner.user_id is null then null else jsonb_build_object(
      'exists',true,'status',v_partner.status,'full_name',v_partner.full_name,'city_code',v_partner.city_code
    ) end,
    'admin', case when v_admin.user_id is null then null else jsonb_build_object(
      'exists',true,'role',v_admin.role,'city_code',v_admin.city_code
    ) end,
    'fleet', case when v_fleet.id is null then null else jsonb_build_object(
      'exists',true,'account_id',v_fleet.id,'business_name',v_fleet.business_name,'status',v_fleet.status
    ) end
  );
end
$$;

revoke all on function public.ensure_my_customer_profile(text,text,text) from public, anon;
revoke all on function public.get_my_loadin_identity() from public, anon;
grant execute on function public.ensure_my_customer_profile(text,text,text) to authenticated, service_role;
grant execute on function public.get_my_loadin_identity() to authenticated, service_role;
