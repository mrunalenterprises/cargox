create table if not exists public.waiting_sessions (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null,
  partner_id uuid not null,
  arrived_at timestamptz not null,
  ended_at timestamptz,
  free_minutes integer not null default 10,
  rate_per_minute numeric(10,2) not null default 0,
  chargeable_minutes integer not null default 0,
  waiting_amount numeric(12,2) not null default 0,
  contact_attempts integer not null default 0,
  no_show_eligible boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.extra_charge_requests (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null,
  requested_by uuid not null,
  charge_type text not null check (charge_type in ('WAITING','TOLL','PARKING','HELPER','NIGHT','ROUTE_CHANGE','OTHER')),
  requested_amount numeric(12,2) not null check (requested_amount >= 0),
  expected_amount numeric(12,2),
  ai_guard_status text not null default 'REVIEW' check (ai_guard_status in ('ALLOW','WARN','REVIEW','BLOCK')),
  ai_guard_reason text,
  variance_pct numeric(8,2),
  evidence_url text,
  customer_approved boolean not null default false,
  customer_approved_at timestamptz,
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED','BLOCKED','MANUAL_REVIEW')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.no_show_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null,
  partner_id uuid not null,
  customer_id uuid not null,
  waited_minutes integer not null,
  contact_attempts integer not null default 0,
  declared_at timestamptz not null default now(),
  evidence jsonb not null default '{}'::jsonb,
  outcome text not null default 'PENDING' check (outcome in ('PENDING','CONFIRMED','REJECTED','WAIVED'))
);

alter table public.waiting_sessions enable row level security;
alter table public.extra_charge_requests enable row level security;
alter table public.no_show_events enable row level security;

create policy "waiting_partner_read" on public.waiting_sessions
for select to authenticated using (auth.uid() = partner_id);

create policy "extra_charge_requester_read" on public.extra_charge_requests
for select to authenticated using (auth.uid() = requested_by);

create policy "extra_charge_requester_insert" on public.extra_charge_requests
for insert to authenticated with check (auth.uid() = requested_by);

create policy "no_show_partner_read" on public.no_show_events
for select to authenticated using (auth.uid() = partner_id);

create policy "no_show_customer_read" on public.no_show_events
for select to authenticated using (auth.uid() = customer_id);

create index if not exists waiting_sessions_booking_idx on public.waiting_sessions(booking_id, created_at desc);
create index if not exists extra_charge_booking_status_idx on public.extra_charge_requests(booking_id, status, created_at desc);
create index if not exists no_show_booking_idx on public.no_show_events(booking_id, declared_at desc);
