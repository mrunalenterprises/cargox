create table if not exists public.admin_dashboard_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_at timestamptz not null default now(),
  city_id uuid,
  total_bookings integer not null default 0,
  completed_bookings integer not null default 0,
  cancelled_bookings integer not null default 0,
  active_bookings integer not null default 0,
  scheduled_bookings integer not null default 0,
  completion_rate_pct numeric(6,2) not null default 0,
  cancellation_rate_pct numeric(6,2) not null default 0,
  gross_booking_value numeric(14,2) not null default 0,
  active_partners integer not null default 0,
  online_partners integer not null default 0,
  restricted_partners integer not null default 0,
  total_customers integer not null default 0,
  restricted_customers integer not null default 0,
  open_critical_incidents integer not null default 0,
  platform_gross_revenue numeric(14,2) not null default 0,
  platform_net_revenue numeric(14,2) not null default 0,
  pending_partner_payout numeric(14,2) not null default 0,
  operations_health_score integer not null default 100,
  operations_health_level text not null default 'HEALTHY' check (operations_health_level in ('HEALTHY','WATCH','AT_RISK','CRITICAL')),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists admin_dashboard_snapshots_city_time_idx
  on public.admin_dashboard_snapshots (city_id, snapshot_at desc);

create table if not exists public.city_performance_snapshots (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null,
  snapshot_date date not null default current_date,
  bookings integer not null default 0,
  completed integer not null default 0,
  cancelled integer not null default 0,
  completion_rate_pct numeric(6,2) not null default 0,
  cancellation_rate_pct numeric(6,2) not null default 0,
  gross_fare numeric(14,2) not null default 0,
  active_partners integer not null default 0,
  online_partners integer not null default 0,
  avg_eta_minutes numeric(8,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (city_id, snapshot_date)
);

create index if not exists city_performance_snapshots_date_idx
  on public.city_performance_snapshots (snapshot_date desc, city_id);

create table if not exists public.service_performance_snapshots (
  id uuid primary key default gen_random_uuid(),
  city_id uuid,
  service_code text not null,
  snapshot_date date not null default current_date,
  bookings integer not null default 0,
  completed integer not null default 0,
  cancelled integer not null default 0,
  completion_rate_pct numeric(6,2) not null default 0,
  cancellation_rate_pct numeric(6,2) not null default 0,
  gross_fare numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (city_id, service_code, snapshot_date)
);

create index if not exists service_performance_snapshots_date_idx
  on public.service_performance_snapshots (snapshot_date desc, service_code, city_id);

create table if not exists public.live_operations_snapshots (
  id uuid primary key default gen_random_uuid(),
  city_id uuid,
  captured_at timestamptz not null default now(),
  active_trips integer not null default 0,
  unassigned_bookings integer not null default 0,
  late_pickups integer not null default 0,
  route_deviations integer not null default 0,
  open_breakdowns integer not null default 0,
  open_safety_incidents integer not null default 0,
  urgent_support_cases integer not null default 0,
  requires_immediate_attention boolean not null default false,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists live_operations_snapshots_city_time_idx
  on public.live_operations_snapshots (city_id, captured_at desc);

alter table public.admin_dashboard_snapshots enable row level security;
alter table public.city_performance_snapshots enable row level security;
alter table public.service_performance_snapshots enable row level security;
alter table public.live_operations_snapshots enable row level security;

-- Dashboard analytics are operational/admin data. No direct client insert/update policies are created.
-- Server/service-role writes snapshots; authorized admin APIs should read them server-side.
