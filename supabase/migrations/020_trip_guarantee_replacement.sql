create table if not exists public.trip_incidents (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null,
  incident_type text not null check (incident_type in ('BREAKDOWN','PARTNER_CANCELLED','ACCIDENT','VEHICLE_UNAVAILABLE','OTHER')),
  original_partner_id uuid not null,
  original_vehicle_id uuid,
  progress_pct numeric(5,2) not null default 0 check (progress_pct between 0 and 100),
  latitude numeric(10,7),
  longitude numeric(10,7),
  notes text,
  reported_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.replacement_assignments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null,
  incident_id uuid not null references public.trip_incidents(id) on delete cascade,
  original_partner_id uuid not null,
  replacement_partner_id uuid,
  replacement_vehicle_id uuid,
  status text not null default 'REQUESTED' check (status in ('REQUESTED','SEARCHING','ASSIGNED','HANDOVER_PENDING','IN_PROGRESS','COMPLETED','FAILED','CANCELLED')),
  original_fare numeric(12,2) not null,
  progress_pct numeric(5,2) not null default 0,
  remaining_fare numeric(12,2) not null default 0,
  original_partner_payout numeric(12,2) not null default 0,
  replacement_partner_entitlement numeric(12,2) not null default 0,
  platform_commission_on_original numeric(12,2) not null default 0,
  customer_additional_charge numeric(12,2) not null default 0,
  customer_must_rebook boolean not null default false,
  requested_at timestamptz not null default now(),
  assigned_at timestamptz,
  completed_at timestamptz
);

create table if not exists public.cargo_handovers (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null,
  replacement_assignment_id uuid not null references public.replacement_assignments(id) on delete cascade,
  from_partner_id uuid not null,
  to_partner_id uuid,
  handover_otp_verified boolean not null default false,
  pickup_proof_present boolean not null default false,
  handover_photo_present boolean not null default false,
  gps_captured boolean not null default false,
  goods_condition_recorded boolean not null default false,
  latitude numeric(10,7),
  longitude numeric(10,7),
  condition_notes text,
  handed_over_at timestamptz
);

alter table public.trip_incidents enable row level security;
alter table public.replacement_assignments enable row level security;
alter table public.cargo_handovers enable row level security;

create policy "participants_read_trip_incidents" on public.trip_incidents
for select to authenticated using (
  auth.uid() = original_partner_id
  or exists (select 1 from public.bookings b where b.id = booking_id and b.customer_id = auth.uid())
);

create policy "participants_read_replacement_assignments" on public.replacement_assignments
for select to authenticated using (
  auth.uid() = original_partner_id
  or auth.uid() = replacement_partner_id
  or exists (select 1 from public.bookings b where b.id = booking_id and b.customer_id = auth.uid())
);

create policy "participants_read_cargo_handovers" on public.cargo_handovers
for select to authenticated using (
  auth.uid() = from_partner_id
  or auth.uid() = to_partner_id
  or exists (select 1 from public.bookings b where b.id = booking_id and b.customer_id = auth.uid())
);

create index if not exists trip_incidents_booking_idx on public.trip_incidents(booking_id, reported_at desc);
create index if not exists replacement_assignments_booking_idx on public.replacement_assignments(booking_id, status);
create index if not exists replacement_assignments_partner_idx on public.replacement_assignments(replacement_partner_id, status);
