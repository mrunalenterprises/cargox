create table if not exists public.admin_members (
  user_id uuid primary key,
  role text not null check (role in ('SUPER_ADMIN','GM','ACCOUNTS','FIELD_OFFICER')),
  city_code text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.partner_admin_reviews (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null,
  vehicle_id uuid,
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED','SUSPENDED')),
  reviewed_by uuid,
  review_notes text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.pricing_rules (
  id uuid primary key default gen_random_uuid(),
  city_code text not null,
  service_type text not null,
  vehicle_class text not null,
  base_fare numeric(12,2) not null default 0 check (base_fare >= 0),
  included_km numeric(8,2) not null default 0 check (included_km >= 0),
  included_minutes integer not null default 0 check (included_minutes >= 0),
  extra_km_rate numeric(12,2) not null default 0 check (extra_km_rate >= 0),
  extra_minute_rate numeric(12,2) not null default 0 check (extra_minute_rate >= 0),
  helper_fee numeric(12,2) not null default 0 check (helper_fee >= 0),
  night_surcharge numeric(12,2) not null default 0 check (night_surcharge >= 0),
  is_active boolean not null default true,
  effective_from timestamptz not null default now(),
  created_by uuid,
  created_at timestamptz not null default now(),
  unique(city_code, service_type, vehicle_class, effective_from)
);

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null,
  actor_role text not null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  before_data jsonb,
  after_data jsonb,
  reason text,
  created_at timestamptz not null default now()
);

alter table public.admin_members enable row level security;
alter table public.partner_admin_reviews enable row level security;
alter table public.pricing_rules enable row level security;
alter table public.admin_audit_log enable row level security;

create policy "admin_read_own_membership" on public.admin_members
for select using (auth.uid() = user_id);

create policy "authenticated_read_active_pricing" on public.pricing_rules
for select to authenticated using (is_active = true);

create index if not exists partner_admin_reviews_partner_idx on public.partner_admin_reviews(partner_id, created_at desc);
create index if not exists pricing_rules_lookup_idx on public.pricing_rules(city_code, service_type, vehicle_class, is_active);
create index if not exists admin_audit_log_entity_idx on public.admin_audit_log(entity_type, entity_id, created_at desc);
