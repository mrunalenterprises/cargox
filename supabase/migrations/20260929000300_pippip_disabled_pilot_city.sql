-- PIP PIP staging city catalog: intentionally inactive and no approved services.
insert into public.cities (name, timezone, is_active)
values ('Chhatrapati Sambhajinagar', 'Asia/Kolkata', false)
on conflict (name) do nothing;

insert into public.city_services (city_id, service, enabled, legal_ready)
select c.id, v.service, false, false
from public.cities as c
cross join (values ('bike'), ('auto'), ('car'), ('outstation'), ('shared')) as v(service)
where c.name = 'Chhatrapati Sambhajinagar'
on conflict (city_id, service) do nothing;
