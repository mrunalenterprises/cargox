-- Admin city/service pricing configuration. Commission Partner remains locked at 15%.

create or replace function public.loadin_admin_city_service_config_snapshot(p_city_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member public.admin_members;
  v_city public.operating_cities;
  v_result jsonb;
begin
  v_member := public.require_loadin_admin(array['SUPER_ADMIN','GM']);
  select * into v_city from public.operating_cities where code = upper(trim(coalesce(p_city_code,'')));
  if not found then raise exception 'city_not_found' using errcode='P0002'; end if;
  if v_member.role <> 'SUPER_ADMIN' and v_member.city_code is distinct from v_city.code then
    raise exception 'admin_city_scope_denied' using errcode='42501';
  end if;

  select jsonb_build_object(
    'city', jsonb_build_object('id',v_city.id,'code',v_city.code,'name',v_city.name,'enabled',v_city.enabled),
    'services', coalesce(jsonb_agg(jsonb_build_object(
      'code',svc.service_code,
      'status',coalesce(csc.status,'COMING_SOON'),
      'schedule_enabled',coalesce(csc.schedule_enabled,true),
      'recurring_enabled',coalesce(csc.recurring_enabled,true),
      'return_load_enabled',coalesce(csc.return_load_enabled,false),
      'base_fare',coalesce(pr.base_fare,0),
      'extra_km_rate',coalesce(pr.extra_km_rate,0),
      'pricing_rule_id',pr.id,
      'commission_pct',15
    ) order by svc.ord),'[]'::jsonb)
  ) into v_result
  from (values
    (1,'PARCEL_2W'),
    (2,'LOADING_VEHICLE'),
    (3,'HELPER'),
    (4,'FULL_SHIFTING')
  ) as svc(ord,service_code)
  left join public.city_service_controls csc on csc.city_id=v_city.id and csc.service_code=svc.service_code
  left join lateral (
    select p.* from public.pricing_rules p
    where p.city_code=v_city.code and p.service_type=svc.service_code and p.vehicle_class='DEFAULT' and p.is_active=true
    order by p.effective_from desc,p.created_at desc limit 1
  ) pr on true;

  return v_result;
end
$$;

create or replace function public.loadin_admin_set_city_pricing(
  p_city_code text,
  p_service_code text,
  p_base_fare numeric,
  p_extra_km_rate numeric,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member public.admin_members;
  v_city public.operating_cities;
  v_service text := upper(trim(coalesce(p_service_code,'')));
  v_old public.pricing_rules;
  v_new public.pricing_rules;
  v_before jsonb;
begin
  v_member := public.require_loadin_admin(array['SUPER_ADMIN','GM']);
  if v_service not in ('PARCEL_2W','LOADING_VEHICLE','HELPER','FULL_SHIFTING') then raise exception 'invalid_service_code' using errcode='22023'; end if;
  if p_base_fare is null or p_base_fare < 0 or p_base_fare > 1000000 then raise exception 'invalid_base_fare' using errcode='22023'; end if;
  if p_extra_km_rate is null or p_extra_km_rate < 0 or p_extra_km_rate > 100000 then raise exception 'invalid_extra_km_rate' using errcode='22023'; end if;

  select * into v_city from public.operating_cities where code=upper(trim(coalesce(p_city_code,'')));
  if not found then raise exception 'city_not_found' using errcode='P0002'; end if;
  if v_member.role <> 'SUPER_ADMIN' and v_member.city_code is distinct from v_city.code then raise exception 'admin_city_scope_denied' using errcode='42501'; end if;

  select * into v_old from public.pricing_rules
  where city_code=v_city.code and service_type=v_service and vehicle_class='DEFAULT' and is_active=true
  order by effective_from desc,created_at desc limit 1
  for update;
  if found then v_before:=to_jsonb(v_old); else v_before:=null; end if;

  update public.pricing_rules
  set is_active=false
  where city_code=v_city.code and service_type=v_service and vehicle_class='DEFAULT' and is_active=true;

  insert into public.pricing_rules(city_code,service_type,vehicle_class,base_fare,included_km,included_minutes,extra_km_rate,extra_minute_rate,helper_fee,night_surcharge,is_active,effective_from,created_by)
  values(v_city.code,v_service,'DEFAULT',round(p_base_fare,2),0,0,round(p_extra_km_rate,2),0,0,0,true,now(),v_member.user_id)
  returning * into v_new;

  insert into public.admin_pricing_changes(city_code,service_code,vehicle_type,old_config,new_config,changed_by,reason)
  values(v_city.code,v_service,'DEFAULT',v_before,to_jsonb(v_new),v_member.user_id,p_reason);

  insert into public.admin_audit_log(actor_user_id,actor_role,action,entity_type,entity_id,before_data,after_data,reason)
  values(v_member.user_id,v_member.role,'SET_CITY_PRICING','PRICING_RULE',v_new.id::text,v_before,to_jsonb(v_new),p_reason);

  return jsonb_build_object('id',v_new.id,'city_code',v_new.city_code,'service_code',v_new.service_type,'base_fare',v_new.base_fare,'extra_km_rate',v_new.extra_km_rate,'commission_pct',15,'effective_from',v_new.effective_from);
end
$$;

revoke all on function public.loadin_admin_city_service_config_snapshot(text) from public, anon;
revoke all on function public.loadin_admin_set_city_pricing(text,text,numeric,numeric,text) from public, anon;
grant execute on function public.loadin_admin_city_service_config_snapshot(text) to authenticated, service_role;
grant execute on function public.loadin_admin_set_city_pricing(text,text,numeric,numeric,text) to authenticated, service_role;
