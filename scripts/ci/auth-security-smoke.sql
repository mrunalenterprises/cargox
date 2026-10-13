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

create or replace function auth.uid()
returns uuid
language sql
stable
as $$ select '11111111-1111-1111-1111-111111111111'::uuid $$;

select public.ensure_my_customer_profile('CI Customer','+919876543210','CSN');

do $$
declare
  v_identity jsonb;
begin
  if not exists (
    select 1 from public.customer_profiles
    where user_id='11111111-1111-1111-1111-111111111111'::uuid
      and full_name='CI Customer'
      and mobile='+919876543210'
      and city_code='CSN'
  ) then
    raise exception 'customer profile bootstrap did not persist expected identity';
  end if;

  select public.get_my_loadin_identity() into v_identity;
  if coalesce((v_identity->'customer'->>'exists')::boolean,false) is not true then
    raise exception 'identity snapshot missing customer role';
  end if;
  if v_identity->>'user_id' <> '11111111-1111-1111-1111-111111111111' then
    raise exception 'identity snapshot returned wrong user';
  end if;
end $$;

delete from public.customer_profiles where user_id='11111111-1111-1111-1111-111111111111'::uuid;

create or replace function auth.uid()
returns uuid
language sql
stable
as $$ select null::uuid $$;
