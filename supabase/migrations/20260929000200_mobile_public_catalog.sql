-- Isolated PIP PIP public catalog; never enables rides or reveals disabled services.
begin;
create policy "public_active_city_preview"
  on public.cities for select to anon using (is_active = true);
create policy "public_approved_service_preview"
  on public.city_services for select to anon
  using (enabled = true and legal_ready = true
         and exists (select 1 from public.cities c
                     where c.id = city_id and c.is_active = true));
grant select on public.cities, public.city_services to anon;
create view public.mobile_city_catalog with (security_invoker = true) as
 select c.name as city, c.timezone, s.service
 from public.cities c join public.city_services s on s.city_id = c.id
 where c.is_active = true and s.enabled = true and s.legal_ready = true;
grant select on public.mobile_city_catalog to anon, authenticated;
commit;
