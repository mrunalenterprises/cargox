-- LOADIN Step 29: Dynamic Pricing Guardrails + Max Fare Protection

create table if not exists public.pricing_guardrails (
  id uuid primary key default gen_random_uuid(),
  city_code text not null,
  service_code text not null,
  vehicle_type text,
  min_multiplier numeric(6,3) not null default 1.000,
  max_multiplier numeric(6,3) not null default 1.250,
  max_fare_increase_pct numeric(6,2) not null default 25.00,
  absolute_max_fare numeric(12,2),
  demand_pricing_enabled boolean not null default true,
  reason_required_above numeric(6,3) not null default 1.150,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(city_code, service_code, vehicle_type)
);

create table if not exists public.dynamic_pricing_snapshots (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid,
  city_code text not null,
  service_code text not null,
  vehicle_type text,
  base_fare numeric(12,2) not null,
  demand_level text not null,
  demand_score numeric(6,2),
  supply_gap integer,
  avg_pickup_eta_min numeric(8,2),
  suggested_multiplier numeric(6,3) not null,
  requested_multiplier numeric(6,3) not null,
  applied_multiplier numeric(6,3) not null,
  final_fare numeric(12,2) not null,
  max_allowed_fare numeric(12,2),
  decision text not null,
  fare_locked boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_pricing_changes (
  id uuid primary key default gen_random_uuid(),
  city_code text not null,
  service_code text not null,
  vehicle_type text,
  old_config jsonb,
  new_config jsonb not null,
  changed_by uuid,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists pricing_guardrails_city_service_idx
  on public.pricing_guardrails(city_code, service_code, is_active);

create index if not exists dynamic_pricing_snapshots_booking_idx
  on public.dynamic_pricing_snapshots(booking_id);

create index if not exists dynamic_pricing_snapshots_city_created_idx
  on public.dynamic_pricing_snapshots(city_code, created_at desc);

create index if not exists admin_pricing_changes_city_created_idx
  on public.admin_pricing_changes(city_code, created_at desc);

alter table public.pricing_guardrails enable row level security;
alter table public.dynamic_pricing_snapshots enable row level security;
alter table public.admin_pricing_changes enable row level security;

-- Public/customer clients may read currently active pricing guardrails so fare previews
-- can explain protection/caps. Writes remain server/admin controlled.
create policy if not exists pricing_guardrails_read_active
  on public.pricing_guardrails
  for select
  using (is_active = true);

-- Booking participants may inspect the pricing snapshot associated with their booking
-- through server-provided booking authorization. Direct anonymous writes are intentionally absent.
-- Admin audit/change tables remain server-side only by default.
