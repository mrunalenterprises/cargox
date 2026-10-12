create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null,
  partner_id uuid,
  vehicle_id uuid,
  city_code text not null,
  service_code text not null,
  status text not null default 'DRAFT' check (status in ('DRAFT','SEARCHING','ASSIGNED','PARTNER_ARRIVING','AT_PICKUP','IN_PROGRESS','COMPLETED','CANCELLED','FAILED')),
  booking_mode text not null default 'NOW' check (booking_mode in ('NOW','SCHEDULED','RECURRING')),
  scheduled_at timestamptz,
  goods_description text,
  pickup_address text not null,
  pickup_lat numeric(10,7),
  pickup_lng numeric(10,7),
  drop_address text not null,
  drop_lat numeric(10,7),
  drop_lng numeric(10,7),
  vehicle_class text,
  fare_locked boolean not null default false,
  locked_fare numeric(12,2) not null default 0,
  customer_payment_mode text check (customer_payment_mode in ('CASH','UPI_DIRECT','ONLINE','BUSINESS_CREDIT')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  cancelled_at timestamptz
);

alter table public.bookings enable row level security;
create policy "customer_read_own_bookings" on public.bookings for select using (auth.uid() = customer_id);
create policy "partner_read_assigned_bookings" on public.bookings for select using (auth.uid() = partner_id);
create policy "customer_create_own_booking" on public.bookings for insert with check (auth.uid() = customer_id);

create index if not exists bookings_customer_created_idx on public.bookings(customer_id, created_at desc);
create index if not exists bookings_partner_status_idx on public.bookings(partner_id, status);
create index if not exists bookings_city_service_status_idx on public.bookings(city_code, service_code, status);
