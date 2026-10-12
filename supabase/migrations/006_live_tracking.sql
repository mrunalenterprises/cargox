create table if not exists public.trip_tracking_sessions (
  booking_id uuid primary key references public.bookings(id) on delete cascade,
  active boolean not null default false,
  share_token text unique,
  share_expires_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.trip_location_points (
  id bigserial primary key,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  partner_id uuid,
  latitude numeric(10,7) not null,
  longitude numeric(10,7) not null,
  accuracy_m numeric(8,2),
  speed_kph numeric(8,2),
  heading numeric(6,2),
  captured_at timestamptz not null default now()
);

alter table public.trip_tracking_sessions enable row level security;
alter table public.trip_location_points enable row level security;
create policy "participants_read_tracking_session" on public.trip_tracking_sessions for select using (exists (select 1 from public.bookings b where b.id=booking_id and (b.customer_id=auth.uid() or b.partner_id=auth.uid())));
create policy "participants_read_tracking_points" on public.trip_location_points for select using (exists (select 1 from public.bookings b where b.id=booking_id and (b.customer_id=auth.uid() or b.partner_id=auth.uid())));

create index if not exists tracking_points_booking_time_idx on public.trip_location_points(booking_id,captured_at desc);
