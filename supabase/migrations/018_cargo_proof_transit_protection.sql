create table if not exists public.booking_cargo_declarations (
  booking_id uuid primary key,
  customer_id uuid not null,
  description text not null,
  declared_value numeric(12,2) not null default 0 check (declared_value >= 0),
  prohibited_goods_confirmed boolean not null default false,
  protection_selected boolean not null default false,
  protection_premium numeric(12,2) not null default 0 check (protection_premium >= 0),
  protection_cover_amount numeric(12,2) not null default 0 check (protection_cover_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.booking_cargo_evidence (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null,
  actor_id uuid not null,
  stage text not null check (stage in ('PICKUP','HANDOVER','DELIVERY')),
  photo_paths text[] not null default '{}',
  video_path text,
  otp_verified boolean not null default false,
  receiver_name text,
  latitude double precision,
  longitude double precision,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  captured_at timestamptz not null default now()
);

create table if not exists public.transit_protection_claims (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null,
  customer_id uuid not null,
  declared_value numeric(12,2) not null default 0,
  requested_amount numeric(12,2) not null default 0 check (requested_amount >= 0),
  status text not null default 'SUBMITTED' check (status in ('SUBMITTED','UNDER_REVIEW','APPROVED','PARTIALLY_APPROVED','REJECTED','PAID')),
  incident_notes text,
  evidence_refs jsonb not null default '[]'::jsonb,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.booking_cargo_declarations enable row level security;
alter table public.booking_cargo_evidence enable row level security;
alter table public.transit_protection_claims enable row level security;

create policy "customer_read_own_cargo_declaration" on public.booking_cargo_declarations
for select using (auth.uid() = customer_id);
create policy "customer_insert_own_cargo_declaration" on public.booking_cargo_declarations
for insert with check (auth.uid() = customer_id);
create policy "customer_update_own_cargo_declaration" on public.booking_cargo_declarations
for update using (auth.uid() = customer_id) with check (auth.uid() = customer_id);

create policy "actor_read_own_cargo_evidence" on public.booking_cargo_evidence
for select using (auth.uid() = actor_id);
create policy "actor_insert_own_cargo_evidence" on public.booking_cargo_evidence
for insert with check (auth.uid() = actor_id);

create policy "customer_read_own_transit_claims" on public.transit_protection_claims
for select using (auth.uid() = customer_id);
create policy "customer_insert_own_transit_claims" on public.transit_protection_claims
for insert with check (auth.uid() = customer_id);

create index if not exists cargo_evidence_booking_stage_idx on public.booking_cargo_evidence(booking_id, stage, captured_at desc);
create index if not exists transit_claim_booking_idx on public.transit_protection_claims(booking_id, created_at desc);
