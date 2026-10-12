create table if not exists public.repeat_routes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  owner_type text not null check (owner_type in ('customer','business')),
  name text,
  service_type text not null,
  pickup_label text not null,
  pickup_lat double precision,
  pickup_lng double precision,
  drop_label text not null,
  drop_lat double precision,
  drop_lng double precision,
  default_notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recurring_booking_plans (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null,
  business_id uuid,
  repeat_route_id uuid references public.repeat_routes(id) on delete set null,
  service_type text not null,
  purpose text,
  start_date date not null,
  end_date date not null,
  weekdays smallint[] not null,
  pickup_time time not null,
  return_enabled boolean not null default false,
  return_time time,
  preferred_partner_id uuid,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','PAUSED','CANCELLED','COMPLETED')),
  pause_from date,
  pause_to date,
  reminder_lead_minutes integer not null default 60 check (reminder_lead_minutes between 5 and 1440),
  generation_horizon_days integer not null default 7 check (generation_horizon_days between 1 and 31),
  fare_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date),
  check ((return_enabled = false and return_time is null) or (return_enabled = true and return_time is not null))
);

create table if not exists public.recurring_booking_occurrences (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.recurring_booking_plans(id) on delete cascade,
  occurrence_date date not null,
  leg text not null check (leg in ('OUTBOUND','RETURN')),
  scheduled_at timestamptz not null,
  booking_id uuid,
  generation_status text not null default 'PLANNED' check (generation_status in ('PLANNED','GENERATED','SKIPPED','CANCELLED','FAILED')),
  reminder_sent_at timestamptz,
  generated_at timestamptz,
  skip_reason text,
  created_at timestamptz not null default now(),
  unique(plan_id, occurrence_date, leg)
);

alter table public.repeat_routes enable row level security;
alter table public.recurring_booking_plans enable row level security;
alter table public.recurring_booking_occurrences enable row level security;

create policy "owner_manage_repeat_routes" on public.repeat_routes
for all to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

create policy "customer_manage_recurring_plans" on public.recurring_booking_plans
for all to authenticated
using (auth.uid() = customer_id)
with check (auth.uid() = customer_id);

create policy "customer_read_occurrences" on public.recurring_booking_occurrences
for select to authenticated
using (exists (
  select 1 from public.recurring_booking_plans p
  where p.id = recurring_booking_occurrences.plan_id and p.customer_id = auth.uid()
));

create index if not exists repeat_routes_owner_idx on public.repeat_routes(owner_id, active);
create index if not exists recurring_plans_customer_status_idx on public.recurring_booking_plans(customer_id, status);
create index if not exists recurring_occurrence_due_idx on public.recurring_booking_occurrences(generation_status, scheduled_at);
