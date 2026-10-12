do $$
declare
  unsecured text;
begin
  select string_agg(format('%I.%I', n.nspname, c.relname), ', ' order by c.relname)
    into unsecured
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and not c.relrowsecurity;

  if unsecured is not null then
    raise exception 'Public tables without RLS: %', unsecured;
  end if;
end
$$;

-- Core deployment dependencies must exist after the full chain.
do $$
begin
  if to_regclass('public.bookings') is null then raise exception 'Missing public.bookings'; end if;
  if to_regclass('public.partner_vehicles') is null then raise exception 'Missing public.partner_vehicles'; end if;
  if to_regclass('public.partner_finance_accounts') is null then raise exception 'Missing public.partner_finance_accounts'; end if;
  if to_regclass('public.support_cases') is null then raise exception 'Missing public.support_cases'; end if;
end
$$;

select count(*) as public_tables,
       count(*) filter (where c.relrowsecurity) as rls_enabled_tables
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r';
