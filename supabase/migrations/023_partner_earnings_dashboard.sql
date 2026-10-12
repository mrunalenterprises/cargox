create table if not exists public.partner_finance_accounts (
  partner_id uuid primary key,
  plan text not null check (plan in ('SUBSCRIPTION','COMMISSION')),
  commission_balance numeric(14,2) not null default 0,
  earnings_balance numeric(14,2) not null default 0,
  pending_payout numeric(14,2) not null default 0,
  minimum_cash_booking_balance numeric(14,2) not null default 0,
  subscription_valid_until timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.partner_finance_ledger (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null,
  booking_id uuid,
  entry_type text not null check (entry_type in (
    'COMMISSION_DEBIT','ONLINE_EARNING_CREDIT','PAYOUT_DEBIT','PAYOUT_REVERSAL',
    'COMMISSION_TOPUP','ADJUSTMENT','SUBSCRIPTION_PAYMENT_REFERENCE'
  )),
  amount numeric(14,2) not null,
  balance_bucket text not null check (balance_bucket in ('COMMISSION','EARNINGS','NONE')),
  reference text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.partner_payout_requests (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null,
  amount numeric(14,2) not null check (amount > 0),
  status text not null default 'REQUESTED' check (status in ('REQUESTED','APPROVED','PROCESSING','PAID','REJECTED','CANCELLED')),
  bank_reference text,
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.partner_finance_accounts enable row level security;
alter table public.partner_finance_ledger enable row level security;
alter table public.partner_payout_requests enable row level security;

create policy "partner_read_own_finance_account" on public.partner_finance_accounts
for select using (auth.uid() = partner_id);

create policy "partner_read_own_finance_ledger" on public.partner_finance_ledger
for select using (auth.uid() = partner_id);

create policy "partner_read_own_payout_requests" on public.partner_payout_requests
for select using (auth.uid() = partner_id);

create policy "partner_create_own_payout_request" on public.partner_payout_requests
for insert with check (auth.uid() = partner_id and status = 'REQUESTED');

create index if not exists partner_finance_ledger_partner_created_idx
on public.partner_finance_ledger(partner_id, created_at desc);

create index if not exists partner_finance_ledger_booking_idx
on public.partner_finance_ledger(booking_id) where booking_id is not null;

create index if not exists partner_payout_requests_partner_status_idx
on public.partner_payout_requests(partner_id, status, requested_at desc);
