create table if not exists public.partner_onboarding (
  partner_id uuid primary key,
  profile jsonb not null default '{}'::jsonb,
  selfie_verified boolean not null default false,
  bank_verified boolean not null default false,
  staff_approved boolean not null default false,
  staff_approved_by uuid,
  staff_approved_at timestamptz,
  admin_decision text check (admin_decision in ('APPROVED','REJECTED')),
  admin_decision_by uuid,
  admin_decision_at timestamptz,
  rejection_reason text,
  onboarding_status text not null default 'DRAFT' check (onboarding_status in ('DRAFT','STAFF_REVIEW','ADMIN_REVIEW','ACTIVE_OFFLINE','REJECTED','SUSPENDED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.partner_documents (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null,
  document_type text not null,
  document_number text,
  storage_path text,
  expiry_date date,
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED','EXPIRED')),
  rejection_reason text,
  verified_by uuid,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(partner_id, document_type)
);

create table if not exists public.partner_vehicles (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null,
  vehicle_category text not null,
  registration_number text not null unique,
  make text,
  model text,
  capacity_kg integer,
  active boolean not null default false,
  eligible_for_booking boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vehicle_documents (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null,
  document_type text not null,
  document_number text,
  storage_path text,
  expiry_date date,
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED','EXPIRED')),
  rejection_reason text,
  verified_by uuid,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(vehicle_id, document_type)
);

create table if not exists public.document_expiry_alerts (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid,
  vehicle_id uuid,
  document_scope text not null check (document_scope in ('PARTNER','VEHICLE')),
  document_type text not null,
  expiry_date date not null,
  alert_level text not null check (alert_level in ('30_DAY','7_DAY','EXPIRED')),
  sent_at timestamptz,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.partner_onboarding enable row level security;
alter table public.partner_documents enable row level security;
alter table public.partner_vehicles enable row level security;
alter table public.vehicle_documents enable row level security;
alter table public.document_expiry_alerts enable row level security;

create policy "partner_read_own_onboarding" on public.partner_onboarding for select using (auth.uid() = partner_id);
create policy "partner_read_own_documents" on public.partner_documents for select using (auth.uid() = partner_id);
create policy "partner_read_own_vehicles" on public.partner_vehicles for select using (auth.uid() = partner_id);
create policy "partner_read_vehicle_documents" on public.vehicle_documents for select using (exists (select 1 from public.partner_vehicles v where v.id = vehicle_id and v.partner_id = auth.uid()));

create index if not exists partner_documents_expiry_idx on public.partner_documents(expiry_date) where status = 'APPROVED';
create index if not exists vehicle_documents_expiry_idx on public.vehicle_documents(expiry_date) where status = 'APPROVED';
create index if not exists partner_vehicles_partner_idx on public.partner_vehicles(partner_id, eligible_for_booking);
