create table if not exists public.demand_heatmap_snapshots (
  id uuid primary key default gen_random_uuid(),
  city_id uuid,
  zone_id uuid,
  service_code text not null,
  lat double precision,
  lng double precision,
  open_bookings integer not null default 0,
  scheduled_next_60_min integer not null default 0,
  recent_searches integer not null default 0,
  online_partners integer not null default 0,
  available_partners integer not null default 0,
  avg_pickup_eta_min numeric(8,2) not null default 0,
  cancellation_rate_pct numeric(8,2) not null default 0,
  demand_score numeric(6,2) not null default 0,
  demand_level text not null check (demand_level in ('LOW','NORMAL','HIGH','VERY_HIGH','SURGE_RISK')),
  partner_shortage integer not null default 0,
  hotspot_action text not null check (hotspot_action in ('NONE','WATCH','POSITION_PARTNERS','URGENT_POSITIONING')),
  captured_at timestamptz not null default now()
);

create index if not exists demand_heatmap_city_service_time_idx
  on public.demand_heatmap_snapshots (city_id, service_code, captured_at desc);

create index if not exists demand_heatmap_zone_time_idx
  on public.demand_heatmap_snapshots (zone_id, captured_at desc);

create index if not exists demand_heatmap_score_idx
  on public.demand_heatmap_snapshots (demand_score desc, captured_at desc);

create table if not exists public.demand_hotspot_predictions (
  id uuid primary key default gen_random_uuid(),
  city_id uuid,
  zone_id uuid,
  service_code text not null,
  predicted_for timestamptz not null,
  demand_score numeric(6,2) not null,
  expected_open_bookings integer not null default 0,
  expected_available_partners integer not null default 0,
  expected_partner_shortage integer not null default 0,
  confidence_pct numeric(5,2) not null default 0,
  recommended_action text not null check (recommended_action in ('NONE','WATCH','POSITION_PARTNERS','URGENT_POSITIONING')),
  model_version text,
  created_at timestamptz not null default now()
);

create index if not exists demand_hotspot_predictions_lookup_idx
  on public.demand_hotspot_predictions (city_id, zone_id, service_code, predicted_for);

create table if not exists public.partner_positioning_alerts (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null,
  city_id uuid,
  zone_id uuid,
  service_code text not null,
  demand_score numeric(6,2) not null,
  demand_level text not null,
  distance_to_zone_km numeric(10,2),
  estimated_extra_trips integer not null default 0,
  status text not null default 'OFFERED' check (status in ('OFFERED','VIEWED','ACCEPTED','DECLINED','EXPIRED','ARRIVED')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

create index if not exists partner_positioning_alerts_partner_idx
  on public.partner_positioning_alerts (partner_id, status, created_at desc);

create index if not exists partner_positioning_alerts_zone_idx
  on public.partner_positioning_alerts (zone_id, status, created_at desc);

alter table public.demand_heatmap_snapshots enable row level security;
alter table public.demand_hotspot_predictions enable row level security;
alter table public.partner_positioning_alerts enable row level security;

-- Heatmap and predictions are operational/admin surfaces. No public insert/update policies.
-- Partners can read only their own positioning alerts.
create policy if not exists "partner reads own positioning alerts"
on public.partner_positioning_alerts
for select
using (partner_id = auth.uid());

create policy if not exists "partner updates own positioning alert response"
on public.partner_positioning_alerts
for update
using (partner_id = auth.uid())
with check (partner_id = auth.uid());
