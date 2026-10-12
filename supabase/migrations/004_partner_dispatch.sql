create table if not exists public.partner_availability (
  partner_id uuid primary key,
  online_status text not null default 'OFFLINE' check (online_status in ('OFFLINE','ONLINE','BUSY','BLOCKED')),
  latitude numeric(10,7),
  longitude numeric(10,7),
  heading numeric(6,2),
  last_seen_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.booking_dispatch_offers (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  partner_id uuid not null,
  vehicle_id uuid,
  wave integer not null default 1,
  score numeric(8,3),
  status text not null default 'OFFERED' check (status in ('OFFERED','ACCEPTED','DECLINED','EXPIRED','CANCELLED')),
  offered_at timestamptz not null default now(),
  expires_at timestamptz not null,
  responded_at timestamptz,
  unique(booking_id, partner_id, wave)
);

alter table public.partner_availability enable row level security;
alter table public.booking_dispatch_offers enable row level security;
create policy "partner_read_own_availability" on public.partner_availability for select using (auth.uid()=partner_id);
create policy "partner_update_own_availability" on public.partner_availability for update using (auth.uid()=partner_id) with check (auth.uid()=partner_id);
create policy "partner_read_own_dispatch_offers" on public.booking_dispatch_offers for select using (auth.uid()=partner_id);

create index if not exists dispatch_booking_status_idx on public.booking_dispatch_offers(booking_id,status,offered_at);
create index if not exists availability_status_seen_idx on public.partner_availability(online_status,last_seen_at desc);
