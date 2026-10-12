create table if not exists public.shifting_jobs (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null,
  booking_id uuid,
  city_id uuid,
  stage text not null default 'DRAFT' check (stage in ('DRAFT','INSPECTION_REQUIRED','INSPECTION_SCHEDULED','QUOTED','ACCEPTED','TEAM_ASSIGNED','PACKING_STARTED','LOADED','IN_TRANSIT','UNLOADING','COMPLETED','CANCELLED')),
  declared_value numeric(12,2) not null default 0,
  inspection_required boolean not null default false,
  inspection_reasons jsonb not null default '[]'::jsonb,
  pickup_details jsonb not null default '{}'::jsonb,
  drop_details jsonb not null default '{}'::jsonb,
  access_details jsonb not null default '{}'::jsonb,
  scheduled_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shifting_inventory_items (
  id uuid primary key default gen_random_uuid(),
  shifting_job_id uuid not null references public.shifting_jobs(id) on delete cascade,
  name text not null,
  quantity integer not null default 1 check (quantity > 0),
  fragile boolean not null default false,
  dismantling_required boolean not null default false,
  appliance boolean not null default false,
  estimated_weight_kg numeric(10,2) not null default 0,
  pickup_condition_photo_url text,
  packed boolean not null default false,
  loaded boolean not null default false,
  delivered boolean not null default false,
  delivery_condition_confirmed boolean not null default false,
  delivery_photo_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.shifting_inspections (
  id uuid primary key default gen_random_uuid(),
  shifting_job_id uuid not null references public.shifting_jobs(id) on delete cascade,
  inspector_id uuid,
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  notes text,
  inventory_verified boolean not null default false,
  access_verified boolean not null default false,
  recommended_vehicle_class text,
  recommended_team_size integer,
  evidence jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.shifting_quotes (
  id uuid primary key default gen_random_uuid(),
  shifting_job_id uuid not null references public.shifting_jobs(id) on delete cascade,
  transport_fare numeric(12,2) not null default 0,
  labour numeric(12,2) not null default 0,
  packing_material numeric(12,2) not null default 0,
  dismantling numeric(12,2) not null default 0,
  appliance_handling numeric(12,2) not null default 0,
  stairs numeric(12,2) not null default 0,
  long_carry numeric(12,2) not null default 0,
  protection numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  tax numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  fare_locked boolean not null default true,
  accepted_by_customer boolean not null default false,
  accepted_at timestamptz,
  valid_until timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.shifting_team_members (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid,
  full_name text not null,
  skills jsonb not null default '[]'::jsonb,
  verified boolean not null default false,
  document_valid boolean not null default false,
  active boolean not null default true,
  verification_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shifting_team_assignments (
  id uuid primary key default gen_random_uuid(),
  shifting_job_id uuid not null references public.shifting_jobs(id) on delete cascade,
  team_member_id uuid not null references public.shifting_team_members(id),
  role text,
  assigned_at timestamptz not null default now(),
  released_at timestamptz,
  unique (shifting_job_id, team_member_id)
);

create table if not exists public.shifting_proof_events (
  id uuid primary key default gen_random_uuid(),
  shifting_job_id uuid not null references public.shifting_jobs(id) on delete cascade,
  event_type text not null check (event_type in ('PICKUP_PHOTO','PACKING_PHOTO','LOADING_PHOTO','HANDOVER_PHOTO','DELIVERY_PHOTO','RECEIVER_OTP','CUSTOMER_SIGNOFF','DAMAGE_NOTE')),
  actor_id uuid,
  media_url text,
  metadata jsonb not null default '{}'::jsonb,
  latitude numeric(10,7),
  longitude numeric(10,7),
  created_at timestamptz not null default now()
);

create index if not exists idx_shifting_jobs_customer on public.shifting_jobs(customer_id, created_at desc);
create index if not exists idx_shifting_jobs_stage on public.shifting_jobs(stage, updated_at desc);
create index if not exists idx_shifting_inventory_job on public.shifting_inventory_items(shifting_job_id);
create index if not exists idx_shifting_inspections_job on public.shifting_inspections(shifting_job_id);
create index if not exists idx_shifting_quotes_job on public.shifting_quotes(shifting_job_id, created_at desc);
create index if not exists idx_shifting_assignments_job on public.shifting_team_assignments(shifting_job_id);
create index if not exists idx_shifting_proof_job on public.shifting_proof_events(shifting_job_id, created_at);

alter table public.shifting_jobs enable row level security;
alter table public.shifting_inventory_items enable row level security;
alter table public.shifting_inspections enable row level security;
alter table public.shifting_quotes enable row level security;
alter table public.shifting_team_members enable row level security;
alter table public.shifting_team_assignments enable row level security;
alter table public.shifting_proof_events enable row level security;

create policy shifting_jobs_customer_read on public.shifting_jobs
for select using (auth.uid() = customer_id);

create policy shifting_inventory_customer_read on public.shifting_inventory_items
for select using (exists (select 1 from public.shifting_jobs j where j.id = shifting_job_id and j.customer_id = auth.uid()));

create policy shifting_inspection_customer_read on public.shifting_inspections
for select using (exists (select 1 from public.shifting_jobs j where j.id = shifting_job_id and j.customer_id = auth.uid()));

create policy shifting_quote_customer_read on public.shifting_quotes
for select using (exists (select 1 from public.shifting_jobs j where j.id = shifting_job_id and j.customer_id = auth.uid()));

create policy shifting_proof_customer_read on public.shifting_proof_events
for select using (exists (select 1 from public.shifting_jobs j where j.id = shifting_job_id and j.customer_id = auth.uid()));

-- Team verification, quote mutation, workflow transitions and assignments are intentionally server/admin controlled.
