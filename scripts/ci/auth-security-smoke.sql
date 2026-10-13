do $$
begin
  if has_function_privilege('anon','public.ensure_my_customer_profile(text,text,text)','EXECUTE') then
    raise exception 'anon must not execute ensure_my_customer_profile';
  end if;
  if has_function_privilege('anon','public.get_my_loadin_identity()','EXECUTE') then
    raise exception 'anon must not execute get_my_loadin_identity';
  end if;
  if not has_function_privilege('authenticated','public.ensure_my_customer_profile(text,text,text)','EXECUTE') then
    raise exception 'authenticated must execute ensure_my_customer_profile';
  end if;
  if not has_function_privilege('authenticated','public.get_my_loadin_identity()','EXECUTE') then
    raise exception 'authenticated must execute get_my_loadin_identity';
  end if;
end $$;
