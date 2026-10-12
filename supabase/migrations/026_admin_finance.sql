create table if not exists public.finance_revenue_entries (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid,
  partner_id uuid,
  city_id uuid,
  revenue_type text not null check (revenue_type in ('COMMISSION','SUBSCRIPTION','OTHER')),
  gross_amount numeric(12,2) not null default 0,
  gateway_fee numeric(12,2) not null default 0,
  refund_amount numeric(12,2) not null default 0,
  net_revenue numeric(12,2) not null default 0,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists finance_revenue_entries_occurred_idx
  on public.finance_revenue_entries (occurred_at desc);
create index if not exists finance_revenue_entries_city_type_idx
  on public.finance_revenue_entries (city_id, revenue_type, occurred_at desc);

create table if not exists public.payout_reconciliations (
  id uuid primary key default gen_random_uuid(),
  payout_request_id uuid,
  partner_id uuid not null,
  expected_amount numeric(12,2) not null default 0,
  settled_amount numeric(12,2) not null default 0,
  difference numeric(12,2) not null default 0,
  status text not null check (status in ('MATCHED','PARTIAL','MISMATCH','PENDING')) default 'PENDING',
  provider_reference text,
  reconciled_by uuid,
  reconciled_at timestamptz,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists payout_reconciliations_partner_status_idx
  on public.payout_reconciliations (partner_id, status, created_at desc);
create index if not exists payout_reconciliations_status_idx
  on public.payout_reconciliations (status, created_at desc);

create table if not exists public.finance_daily_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null,
  city_id uuid,
  completed_trips integer not null default 0,
  gross_booking_value numeric(14,2) not null default 0,
  gross_commission numeric(14,2) not null default 0,
  subscription_revenue numeric(14,2) not null default 0,
  gateway_fees numeric(14,2) not null default 0,
  refunds numeric(14,2) not null default 0,
  goodwill_credits numeric(14,2) not null default 0,
  operating_adjustments numeric(14,2) not null default 0,
  platform_net_revenue numeric(14,2) not null default 0,
  partner_payouts numeric(14,2) not null default 0,
  pending_payouts numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (snapshot_date, city_id)
);

create index if not exists finance_daily_snapshots_date_city_idx
  on public.finance_daily_snapshots (snapshot_date desc, city_id);

alter table public.finance_revenue_entries enable row level security;
alter table public.payout_reconciliations enable row level security;
alter table public.finance_daily_snapshots enable row level security;

-- These finance tables are intentionally server/admin controlled. No public/customer/partner
-- write policies are created. Finance/Admin service roles should access via trusted backend.

create policy "partner can read own payout reconciliation"
  on public.payout_reconciliations
  for select
  using (partner_id = auth.uid());
