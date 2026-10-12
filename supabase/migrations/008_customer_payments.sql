create table if not exists public.customer_payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  customer_id uuid not null,
  provider text,
  payment_mode text not null check (payment_mode in ('CASH','UPI_DIRECT','ONLINE','BUSINESS_CREDIT')),
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'INR',
  status text not null default 'PENDING' check (status in ('PENDING','AUTHORIZED','PAID','FAILED','REFUNDED','PARTIALLY_REFUNDED','CANCELLED')),
  provider_payment_id text,
  provider_order_id text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.customer_payments(id) on delete restrict,
  booking_id uuid not null references public.bookings(id) on delete restrict,
  customer_id uuid not null,
  amount numeric(12,2) not null check (amount > 0),
  reason text,
  status text not null default 'REQUESTED' check (status in ('REQUESTED','APPROVED','PROCESSING','COMPLETED','FAILED','REJECTED')),
  provider_refund_id text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.customer_payments enable row level security;
alter table public.payment_refunds enable row level security;
create policy "customer_read_own_payments" on public.customer_payments for select using (auth.uid()=customer_id);
create policy "customer_read_own_refunds" on public.payment_refunds for select using (auth.uid()=customer_id);

create index if not exists customer_payments_booking_idx on public.customer_payments(booking_id,status);
create index if not exists customer_payments_customer_time_idx on public.customer_payments(customer_id,created_at desc);
create index if not exists payment_refunds_booking_idx on public.payment_refunds(booking_id,status);
