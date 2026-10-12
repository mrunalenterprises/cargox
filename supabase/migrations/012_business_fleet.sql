create table if not exists public.fleet_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  business_name text,
  gstin text,
  status text not null default 'active' check (status in ('active','suspended','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fleet_vehicles (
  id uuid primary key default gen_random_uuid(),
  fleet_account_id uuid not null references public.fleet_accounts(id) on delete cascade,
  partner_vehicle_id uuid,
  registration_number text not null,
  vehicle_type text not null,
  status text not null default 'active' check (status in ('active','inactive','blocked','maintenance')),
  created_at timestamptz not null default now(),
  unique (fleet_account_id, registration_number)
);

create table if not exists public.fleet_drivers (
  id uuid primary key default gen_random_uuid(),
  fleet_account_id uuid not null references public.fleet_accounts(id) on delete cascade,
  partner_user_id uuid,
  full_name text not null,
  mobile text,
  status text not null default 'active' check (status in ('active','inactive','blocked')),
  created_at timestamptz not null default now()
);

create table if not exists public.fleet_driver_vehicle_assignments (
  id uuid primary key default gen_random_uuid(),
  fleet_account_id uuid not null references public.fleet_accounts(id) on delete cascade,
  fleet_vehicle_id uuid not null references public.fleet_vehicles(id) on delete cascade,
  fleet_driver_id uuid not null references public.fleet_drivers(id) on delete cascade,
  status text not null default 'active' check (status in ('active','ended')),
  assigned_at timestamptz not null default now(),
  ended_at timestamptz
);

create unique index if not exists fleet_active_vehicle_assignment_idx
on public.fleet_driver_vehicle_assignments(fleet_vehicle_id)
where status = 'active';

create unique index if not exists fleet_active_driver_assignment_idx
on public.fleet_driver_vehicle_assignments(fleet_driver_id)
where status = 'active';

create table if not exists public.fleet_earning_snapshots (
  id uuid primary key default gen_random_uuid(),
  fleet_account_id uuid not null references public.fleet_accounts(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  completed_trips integer not null default 0,
  gross_customer_fare numeric(12,2) not null default 0,
  fleet_earning numeric(12,2) not null default 0,
  platform_commission numeric(12,2) not null default 0,
  payout_amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (fleet_account_id, period_start, period_end)
);

alter table public.fleet_accounts enable row level security;
alter table public.fleet_vehicles enable row level security;
alter table public.fleet_drivers enable row level security;
alter table public.fleet_driver_vehicle_assignments enable row level security;
alter table public.fleet_earning_snapshots enable row level security;

create policy "fleet_owner_read_account" on public.fleet_accounts
for select using (auth.uid() = owner_user_id);
create policy "fleet_owner_update_account" on public.fleet_accounts
for update using (auth.uid() = owner_user_id) with check (auth.uid() = owner_user_id);

create policy "fleet_owner_manage_vehicles" on public.fleet_vehicles
for all using (exists (select 1 from public.fleet_accounts a where a.id = fleet_account_id and a.owner_user_id = auth.uid()))
with check (exists (select 1 from public.fleet_accounts a where a.id = fleet_account_id and a.owner_user_id = auth.uid()));

create policy "fleet_owner_manage_drivers" on public.fleet_drivers
for all using (exists (select 1 from public.fleet_accounts a where a.id = fleet_account_id and a.owner_user_id = auth.uid()))
with check (exists (select 1 from public.fleet_accounts a where a.id = fleet_account_id and a.owner_user_id = auth.uid()));

create policy "fleet_owner_manage_assignments" on public.fleet_driver_vehicle_assignments
for all using (exists (select 1 from public.fleet_accounts a where a.id = fleet_account_id and a.owner_user_id = auth.uid()))
with check (exists (select 1 from public.fleet_accounts a where a.id = fleet_account_id and a.owner_user_id = auth.uid()));

create policy "fleet_owner_read_earnings" on public.fleet_earning_snapshots
for select using (exists (select 1 from public.fleet_accounts a where a.id = fleet_account_id and a.owner_user_id = auth.uid()));

create index if not exists fleet_vehicles_account_idx on public.fleet_vehicles(fleet_account_id, status);
create index if not exists fleet_drivers_account_idx on public.fleet_drivers(fleet_account_id, status);
create index if not exists fleet_earnings_account_period_idx on public.fleet_earning_snapshots(fleet_account_id, period_start desc);
