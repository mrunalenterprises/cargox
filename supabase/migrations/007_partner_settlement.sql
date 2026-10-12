create table if not exists public.booking_partner_settlements (
  booking_id uuid primary key references public.bookings(id) on delete cascade,
  partner_id uuid not null,
  plan text not null check (plan in ('SUBSCRIPTION','COMMISSION')),
  commissionable_fare numeric(12,2) not null default 0,
  commission_rate_pct numeric(5,2) not null default 0,
  commission_amount numeric(12,2) not null default 0,
  partner_entitlement numeric(12,2) not null default 0,
  settlement_mode text not null check (settlement_mode in ('DIRECT_CUSTOMER_PAYMENT','PLATFORM_PAYOUT','COMMISSION_BALANCE_DEBIT')),
  status text not null default 'PENDING' check (status in ('PENDING','CALCULATED','SETTLED','REVERSED','FAILED')),
  settled_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.partner_balance_events (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null,
  booking_id uuid references public.bookings(id) on delete set null,
  bucket text not null check (bucket in ('COMMISSION','EARNINGS','SECURITY')),
  direction text not null check (direction in ('CREDIT','DEBIT')),
  amount numeric(12,2) not null check (amount >= 0),
  reason text not null,
  created_at timestamptz not null default now()
);

alter table public.booking_partner_settlements enable row level security;
alter table public.partner_balance_events enable row level security;
create policy "partner_read_own_booking_settlement" on public.booking_partner_settlements for select using (auth.uid()=partner_id);
create policy "partner_read_own_balance_events" on public.partner_balance_events for select using (auth.uid()=partner_id);

create index if not exists settlement_partner_status_idx on public.booking_partner_settlements(partner_id,status);
create index if not exists partner_balance_events_partner_time_idx on public.partner_balance_events(partner_id,created_at desc);
