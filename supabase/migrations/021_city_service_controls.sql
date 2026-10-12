create table if not exists public.operating_cities (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  state_name text,
  country_code text not null default 'IN',
  enabled boolean not null default false,
  allow_outstation_drop boolean not null default false,
  timezone text not null default 'Asia/Kolkata',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.operating_zones (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.operating_cities(id) on delete cascade,
  code text not null,
  name text not null,
  enabled boolean not null default true,
  min_lat numeric(9,6) not null,
  max_lat numeric(9,6) not null,
  min_lng numeric(9,6) not null,
  max_lng numeric(9,6) not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (city_id, code),
  check (min_lat <= max_lat),
  check (min_lng <= max_lng)
);

create table if not exists public.city_service_controls (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.operating_cities(id) on delete cascade,
  service_code text not null check (service_code in ('PARCEL_2W','LOADING_VEHICLE','HELPER','FULL_SHIFTING')),
  status text not null default 'COMING_SOON' check (status in ('ACTIVE','COMING_SOON','PAUSED','DISABLED')),
  allowed_vehicle_types text[] not null default '{}',
  allowed_zone_codes text[] not null default '{}',
  schedule_enabled boolean not null default true,
  recurring_enabled boolean not null default true,
  return_load_enabled boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (city_id, service_code)
);

create table if not exists public.city_service_change_log (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.operating_cities(id) on delete cascade,
  service_control_id uuid references public.city_service_controls(id) on delete set null,
  actor_id uuid,
  old_status text,
  new_status text,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.operating_cities enable row level security;
alter table public.operating_zones enable row level security;
alter table public.city_service_controls enable row level security;
alter table public.city_service_change_log enable row level security;

create policy "authenticated_read_operating_cities" on public.operating_cities
for select to authenticated using (true);

create policy "authenticated_read_operating_zones" on public.operating_zones
for select to authenticated using (true);

create policy "authenticated_read_city_service_controls" on public.city_service_controls
for select to authenticated using (true);

-- Writes remain server/admin controlled. Public clients should never toggle city/service availability directly.

create index if not exists operating_zones_city_enabled_idx on public.operating_zones(city_id, enabled);
create index if not exists city_service_controls_lookup_idx on public.city_service_controls(city_id, service_code, status);
create index if not exists city_service_change_log_city_created_idx on public.city_service_change_log(city_id, created_at desc);
