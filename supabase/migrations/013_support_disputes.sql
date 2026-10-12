create table if not exists public.support_cases (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null,
  customer_id uuid,
  partner_id uuid,
  category text not null,
  status text not null default 'OPEN' check (status in ('OPEN','IN_REVIEW','WAITING_CUSTOMER','WAITING_PARTNER','RESOLVED','CLOSED')),
  priority text not null default 'NORMAL' check (priority in ('LOW','NORMAL','HIGH','URGENT')),
  case_owner_id uuid,
  active_trip_escalation boolean not null default false,
  safety_risk boolean not null default false,
  resolution_code text,
  resolution_notes text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists support_cases_one_open_per_booking_idx
on public.support_cases(booking_id)
where status not in ('RESOLVED','CLOSED');

create table if not exists public.support_case_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.support_cases(id) on delete cascade,
  actor_id uuid,
  actor_role text,
  event_type text not null,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.customer_remedies (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.support_cases(id) on delete restrict,
  booking_id uuid not null,
  customer_id uuid not null,
  remedy_type text not null check (remedy_type in ('FULL_REFUND','PARTIAL_REFUND','GOODWILL_CREDIT','MANUAL_DAMAGE_REVIEW','NO_REFUND','MANUAL_REVIEW')),
  refund_amount numeric(12,2) not null default 0 check (refund_amount >= 0),
  credit_amount numeric(12,2) not null default 0 check (credit_amount >= 0),
  approval_level text not null check (approval_level in ('SUPPORT','GM','SUPER_ADMIN')),
  approved_by uuid,
  approved_at timestamptz,
  external_ref text,
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','PROCESSING','COMPLETED','REJECTED','FAILED')),
  created_at timestamptz not null default now()
);

alter table public.support_cases enable row level security;
alter table public.support_case_events enable row level security;
alter table public.customer_remedies enable row level security;

create policy "customer_read_own_support_cases" on public.support_cases
for select using (auth.uid() = customer_id);
create policy "partner_read_own_support_cases" on public.support_cases
for select using (auth.uid() = partner_id);
create policy "customer_create_own_support_case" on public.support_cases
for insert with check (auth.uid() = customer_id);
create policy "partner_create_own_support_case" on public.support_cases
for insert with check (auth.uid() = partner_id);

create policy "customer_read_own_case_events" on public.support_case_events
for select using (exists (
  select 1 from public.support_cases c where c.id = case_id and c.customer_id = auth.uid()
));
create policy "partner_read_own_case_events" on public.support_case_events
for select using (exists (
  select 1 from public.support_cases c where c.id = case_id and c.partner_id = auth.uid()
));

create policy "customer_read_own_remedies" on public.customer_remedies
for select using (auth.uid() = customer_id);

create index if not exists support_cases_priority_created_idx on public.support_cases(priority, created_at);
create index if not exists support_cases_owner_status_idx on public.support_cases(case_owner_id, status);
create index if not exists support_case_events_case_created_idx on public.support_case_events(case_id, created_at);
create index if not exists customer_remedies_case_idx on public.customer_remedies(case_id);
