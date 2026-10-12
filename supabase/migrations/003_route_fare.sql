create table if not exists public.booking_route_snapshots (
  booking_id uuid primary key references public.bookings(id) on delete cascade,
  provider text not null default 'GOOGLE_DIRECTIONS',
  distance_meters integer not null default 0,
  duration_seconds integer not null default 0,
  route_polyline text,
  toll_estimate numeric(12,2) not null default 0,
  captured_at timestamptz not null default now()
);

create table if not exists public.booking_fare_snapshots (
  booking_id uuid primary key references public.bookings(id) on delete cascade,
  base_fare numeric(12,2) not null default 0,
  distance_fare numeric(12,2) not null default 0,
  time_fare numeric(12,2) not null default 0,
  helper_fare numeric(12,2) not null default 0,
  demand_adjustment numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  passthroughs numeric(12,2) not null default 0,
  locked_fare numeric(12,2) not null default 0,
  pricing_version text,
  calculation jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.booking_route_snapshots enable row level security;
alter table public.booking_fare_snapshots enable row level security;
create policy "booking_participants_read_route" on public.booking_route_snapshots for select using (exists (select 1 from public.bookings b where b.id=booking_id and (b.customer_id=auth.uid() or b.partner_id=auth.uid())));
create policy "booking_participants_read_fare" on public.booking_fare_snapshots for select using (exists (select 1 from public.bookings b where b.id=booking_id and (b.customer_id=auth.uid() or b.partner_id=auth.uid())));
