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
