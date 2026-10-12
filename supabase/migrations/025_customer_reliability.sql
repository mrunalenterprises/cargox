create table if not exists public.customer_reliability_snapshots (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null,
  score numeric(5,2) not null check (score >= 0 and score <= 100),
  level text not null check (level in ('EXCELLENT','GOOD','WATCH','RESTRICTED')),
  booking_restriction text not null default 'NONE' check (booking_restriction in ('NONE','PREPAID_ONLY','MANUAL_REVIEW','BLOCKED')),
  restriction_reason text,
  completed_trips integer not null default 0,
  customer_cancellations integer not null default 0,
  post_assignment_cancellations integer not null default 0,
  no_shows integer not null default 0,
  payment_failures integer not null default 0,
  disputes_lost integer not null default 0,
  fraud_flags integer not null default 0,
  calculated_at timestamptz not null default now()
);

create index if not exists customer_reliability_customer_date_idx
  on public.customer_reliability_snapshots(customer_id, calculated_at desc);

create table if not exists public.customer_behavior_events (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null,
  booking_id uuid,
  event_type text not null check (event_type in (
    'TRIP_COMPLETED','CANCEL_BEFORE_ASSIGNMENT','CANCEL_AFTER_ASSIGNMENT',
    'CANCEL_AT_PICKUP','NO_SHOW','PAYMENT_FAILURE','DISPUTE_LOST',
    'FRAUD_FLAG','EMERGENCY_WAIVER','PARTNER_FAULT_WAIVER','PLATFORM_FAULT_WAIVER'
  )),
  penalty_points numeric(6,2) not null default 0,
  fee_eligible boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists customer_behavior_customer_date_idx
  on public.customer_behavior_events(customer_id, created_at desc);
create index if not exists customer_behavior_booking_idx
  on public.customer_behavior_events(booking_id) where booking_id is not null;

create table if not exists public.customer_booking_restrictions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null,
  restriction text not null check (restriction in ('PREPAID_ONLY','MANUAL_REVIEW','BLOCKED')),
  reason text not null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  lifted_at timestamptz,
  lifted_by uuid,
  created_at timestamptz not null default now()
);

create unique index if not exists customer_one_active_restriction_idx
  on public.customer_booking_restrictions(customer_id)
  where lifted_at is null;

alter table public.customer_reliability_snapshots enable row level security;
alter table public.customer_behavior_events enable row level security;
alter table public.customer_booking_restrictions enable row level security;

create policy "customers read own reliability"
  on public.customer_reliability_snapshots for select
  using (auth.uid() = customer_id);

create policy "customers read own behavior"
  on public.customer_behavior_events for select
  using (auth.uid() = customer_id);

create policy "customers read own restrictions"
  on public.customer_booking_restrictions for select
  using (auth.uid() = customer_id);

-- Scoring, event insertion and restriction changes are intended to be server/admin controlled.
