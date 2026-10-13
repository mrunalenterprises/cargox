-- Production account + notification-center helpers.

create or replace function public.get_my_notification_center()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_preferences public.notification_preferences;
  v_items jsonb;
  v_unread integer;
begin
  if v_uid is null then raise exception 'authentication_required' using errcode='42501'; end if;

  insert into public.notification_preferences(user_id)
  values (v_uid)
  on conflict (user_id) do nothing;

  select * into v_preferences
  from public.notification_preferences
  where user_id = v_uid;

  select coalesce(jsonb_agg(to_jsonb(n) order by n.created_at desc),'[]'::jsonb),
         count(*) filter (where n.status not in ('OPENED','CANCELLED','EXPIRED'))
    into v_items, v_unread
  from (
    select id, booking_id, notification_type, priority, title, body, payload,
           sound_key, vibration, status, scheduled_for, sent_at, delivered_at,
           opened_at, expires_at, created_at
    from public.notifications
    where user_id = v_uid
    order by created_at desc
    limit 100
  ) n;

  return jsonb_build_object(
    'preferences', to_jsonb(v_preferences),
    'unreadCount', coalesce(v_unread,0),
    'notifications', v_items
  );
end
$$;

create or replace function public.mark_all_my_notifications_opened()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_count integer;
begin
  if v_uid is null then raise exception 'authentication_required' using errcode='42501'; end if;

  update public.notifications
     set status='OPENED', opened_at=coalesce(opened_at,now())
   where user_id=v_uid
     and status not in ('OPENED','CANCELLED','EXPIRED');
  get diagnostics v_count = row_count;
  return v_count;
end
$$;

create or replace function public.set_my_notification_preferences(
  p_booking_alerts boolean default null,
  p_scheduled_reminders boolean default null,
  p_document_expiry boolean default null,
  p_high_demand boolean default null,
  p_return_load boolean default null,
  p_support_updates boolean default null,
  p_quiet_hours_enabled boolean default null,
  p_quiet_hours_start time default null,
  p_quiet_hours_end time default null
)
returns public.notification_preferences
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.notification_preferences;
begin
  if v_uid is null then raise exception 'authentication_required' using errcode='42501'; end if;

  insert into public.notification_preferences(user_id)
  values (v_uid)
  on conflict (user_id) do nothing;

  update public.notification_preferences
     set booking_alerts = coalesce(p_booking_alerts,booking_alerts),
         scheduled_reminders = coalesce(p_scheduled_reminders,scheduled_reminders),
         document_expiry = coalesce(p_document_expiry,document_expiry),
         high_demand = coalesce(p_high_demand,high_demand),
         return_load = coalesce(p_return_load,return_load),
         support_updates = coalesce(p_support_updates,support_updates),
         quiet_hours_enabled = coalesce(p_quiet_hours_enabled,quiet_hours_enabled),
         quiet_hours_start = case when p_quiet_hours_enabled is false then null else coalesce(p_quiet_hours_start,quiet_hours_start) end,
         quiet_hours_end = case when p_quiet_hours_enabled is false then null else coalesce(p_quiet_hours_end,quiet_hours_end) end,
         updated_at = now()
   where user_id = v_uid
  returning * into v_row;

  return v_row;
end
$$;

create or replace function public.update_my_customer_profile(
  p_full_name text default null,
  p_email text default null,
  p_city_code text default null
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
  if v_uid is null then raise exception 'authentication_required' using errcode='42501'; end if;

  insert into public.customer_profiles(user_id,full_name,email,city_code,updated_at)
  values(
    v_uid,
    nullif(trim(coalesce(p_full_name,'')),''),
    nullif(trim(coalesce(p_email,'')),''),
    nullif(trim(coalesce(p_city_code,'')),''),
    now()
  )
  on conflict (user_id) do update set
    full_name = coalesce(nullif(trim(coalesce(excluded.full_name,'')),''), public.customer_profiles.full_name),
    email = coalesce(nullif(trim(coalesce(excluded.email,'')),''), public.customer_profiles.email),
    city_code = coalesce(nullif(trim(coalesce(excluded.city_code,'')),''), public.customer_profiles.city_code),
    updated_at = now()
  returning * into v_row;

  return v_row;
end
$$;

revoke all on function public.get_my_notification_center() from public, anon;
revoke all on function public.mark_all_my_notifications_opened() from public, anon;
revoke all on function public.set_my_notification_preferences(boolean,boolean,boolean,boolean,boolean,boolean,boolean,time,time) from public, anon;
revoke all on function public.update_my_customer_profile(text,text,text) from public, anon;

grant execute on function public.get_my_notification_center() to authenticated, service_role;
grant execute on function public.mark_all_my_notifications_opened() to authenticated, service_role;
grant execute on function public.set_my_notification_preferences(boolean,boolean,boolean,boolean,boolean,boolean,boolean,time,time) to authenticated, service_role;
grant execute on function public.update_my_customer_profile(text,text,text) to authenticated, service_role;
