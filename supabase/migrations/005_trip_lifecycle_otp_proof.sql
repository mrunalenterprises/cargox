create table if not exists public.booking_otps (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  otp_type text not null check (otp_type in ('PICKUP','START','DELIVERY','HANDOVER')),
  otp_hash text not null,
  verified boolean not null default false,
  verified_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.booking_proofs (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  proof_type text not null check (proof_type in ('PICKUP_PHOTO','PICKUP_VIDEO','HANDOVER_PHOTO','DELIVERY_PHOTO','DELIVERY_VIDEO','RECEIVER_SIGNATURE','RECEIVER_NAME','OTHER')),
  storage_path text,
  note text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  captured_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.booking_status_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  from_status text,
  to_status text not null,
  actor_id uuid,
  actor_role text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.booking_otps enable row level security;
alter table public.booking_proofs enable row level security;
alter table public.booking_status_events enable row level security;
create policy "participants_read_booking_proofs" on public.booking_proofs for select using (exists (select 1 from public.bookings b where b.id=booking_id and (b.customer_id=auth.uid() or b.partner_id=auth.uid())));
create policy "participants_read_booking_events" on public.booking_status_events for select using (exists (select 1 from public.bookings b where b.id=booking_id and (b.customer_id=auth.uid() or b.partner_id=auth.uid())));

create index if not exists booking_otps_booking_type_idx on public.booking_otps(booking_id,otp_type,created_at desc);
create index if not exists booking_proofs_booking_created_idx on public.booking_proofs(booking_id,created_at);
