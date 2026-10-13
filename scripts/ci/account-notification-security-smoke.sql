do $$
begin
  if has_function_privilege('anon','public.get_my_notification_center()','EXECUTE') then
    raise exception 'anon must not execute get_my_notification_center';
  end if;
  if has_function_privilege('anon','public.mark_all_my_notifications_opened()','EXECUTE') then
    raise exception 'anon must not execute mark_all_my_notifications_opened';
  end if;
  if has_function_privilege('anon','public.set_my_notification_preferences(boolean,boolean,boolean,boolean,boolean,boolean,boolean,time without time zone,time without time zone)','EXECUTE') then
    raise exception 'anon must not execute set_my_notification_preferences';
  end if;
  if has_function_privilege('anon','public.update_my_customer_profile(text,text,text)','EXECUTE') then
    raise exception 'anon must not execute update_my_customer_profile';
  end if;
  if not has_function_privilege('authenticated','public.get_my_notification_center()','EXECUTE') then
    raise exception 'authenticated must execute get_my_notification_center';
  end if;
  if not has_function_privilege('authenticated','public.mark_all_my_notifications_opened()','EXECUTE') then
    raise exception 'authenticated must execute mark_all_my_notifications_opened';
  end if;
  if not has_function_privilege('authenticated','public.update_my_customer_profile(text,text,text)','EXECUTE') then
    raise exception 'authenticated must execute update_my_customer_profile';
  end if;
end $$;

create or replace function auth.uid()
returns uuid
language sql
stable
as $$ select '22222222-2222-2222-2222-222222222222'::uuid $$;

insert into public.customer_profiles(user_id,full_name,mobile,city_code)
values('22222222-2222-2222-2222-222222222222','Before Update','+919999000000','CSN')
on conflict (user_id) do nothing;

select public.update_my_customer_profile('CI Updated','ci-notify@example.com','CSN');
select public.set_my_notification_preferences(true,true,true,false,true,true,true,'22:00'::time,'07:00'::time);

insert into public.notifications(user_id,notification_type,priority,title,body,status,created_at)
values
('22222222-2222-2222-2222-222222222222','TRIP_UPDATE','NORMAL','CI Trip','Test trip update','DELIVERED',now()),
('22222222-2222-2222-2222-222222222222','PAYMENT_UPDATE','NORMAL','CI Payment','Test payment update','OPENED',now());

do $$
declare
  v_center jsonb;
  v_marked integer;
begin
  if not exists (
    select 1 from public.customer_profiles
    where user_id='22222222-2222-2222-2222-222222222222'::uuid
      and full_name='CI Updated'
      and email='ci-notify@example.com'
  ) then
    raise exception 'customer account update RPC did not persist';
  end if;

  select public.get_my_notification_center() into v_center;
  if (v_center->>'unreadCount')::integer <> 1 then
    raise exception 'notification center unread count mismatch: %', v_center->>'unreadCount';
  end if;
  if coalesce((v_center->'preferences'->>'quiet_hours_enabled')::boolean,false) is not true then
    raise exception 'notification preferences did not persist';
  end if;

  select public.mark_all_my_notifications_opened() into v_marked;
  if v_marked <> 1 then
    raise exception 'mark all opened count mismatch: %', v_marked;
  end if;
  if exists (
    select 1 from public.notifications
    where user_id='22222222-2222-2222-2222-222222222222'::uuid
      and status not in ('OPENED','CANCELLED','EXPIRED')
  ) then
    raise exception 'mark all opened left unread notifications';
  end if;
end $$;

delete from public.notifications where user_id='22222222-2222-2222-2222-222222222222'::uuid;
delete from public.notification_preferences where user_id='22222222-2222-2222-2222-222222222222'::uuid;
delete from public.customer_profiles where user_id='22222222-2222-2222-2222-222222222222'::uuid;

create or replace function auth.uid()
returns uuid
language sql
stable
as $$ select null::uuid $$;
