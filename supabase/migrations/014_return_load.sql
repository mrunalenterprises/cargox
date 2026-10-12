create table if not exists public.return_load_preferences (
  partner_id uuid primary key,
  enabled boolean not null default true,
  return_target_lat double precision,
  return_target_lng double precision,
  max_pickup_detour_km numeric(6,2) not null default 6,
  max_drop_detour_km numeric(6,2) not null default 12,
  updated_at timestamptz not null default now()
);

create table if not exists public.return_load_matches (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null,
  partner_id uuid not null,
  vehicle_id uuid,
  source_booking_id uuid,
  match_score smallint not null check (match_score between 0 and 100),
  pickup_detour_km numeric(7,2),
  drop_detour_km numeric(7,2),
  direction_score smallint check (direction_score between 0 and 100),
  discount_pct numeric(5,2) not null default 0,
  original_fare numeric(12,2) not null default 0,
  discounted_fare numeric(12,2) not null default 0,
  partner_earning numeric(12,2) not null default 0,
  platform_commission numeric(12,2) not null default 0,
  status text not null default 'offered' check (status in ('offered','accepted','declined','expired','completed','cancelled')),
  offered_at timestamptz not null default now(),
  accepted_at timestamptz,
  completed_at timestamptz
);

alter table public.return_load_preferences enable row level security;
alter table public.return_load_matches enable row level security;

create policy "partner_read_own_return_load_preferences" on public.return_load_preferences
for select using (auth.uid() = partner_id);

create policy "partner_update_own_return_load_preferences" on public.return_load_preferences
for update using (auth.uid() = partner_id) with check (auth.uid() = partner_id);

create policy "partner_insert_own_return_load_preferences" on public.return_load_preferences
for insert with check (auth.uid() = partner_id);

create policy "partner_read_own_return_load_matches" on public.return_load_matches
for select using (auth.uid() = partner_id);

create index if not exists return_load_matches_partner_status_idx
on public.return_load_matches(partner_id, status, offered_at desc);

create index if not exists return_load_matches_booking_idx
on public.return_load_matches(booking_id);
