create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  promotion_type text not null check (promotion_type in ('FLAT','PERCENTAGE','REFERRAL_CREDIT','BUSINESS_DISCOUNT')),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','PAUSED','EXPIRED','DISABLED')),
  value numeric(12,2) not null check (value >= 0),
  max_discount numeric(12,2),
  minimum_fare numeric(12,2) not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  first_booking_only boolean not null default false,
  per_customer_limit integer not null default 1,
  global_redemption_limit integer,
  city_codes text[] not null default '{}',
  service_codes text[] not null default '{}',
  vehicle_types text[] not null default '{}',
  business_account_id uuid,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.promotion_redemptions (
  id uuid primary key default gen_random_uuid(),
  promotion_id uuid not null references public.promotions(id) on delete restrict,
  booking_id uuid not null,
  customer_id uuid not null,
  business_account_id uuid,
  original_fare numeric(12,2) not null,
  discount_amount numeric(12,2) not null check (discount_amount >= 0),
  final_fare numeric(12,2) not null check (final_fare >= 0),
  status text not null default 'APPLIED' check (status in ('APPLIED','REVERSED','VOID')),
  created_at timestamptz not null default now(),
  unique (promotion_id, booking_id)
);

create table if not exists public.referral_codes (
  id uuid primary key default gen_random_uuid(),
  owner_customer_id uuid not null,
  code text not null unique,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','PAUSED','DISABLED')),
  created_at timestamptz not null default now()
);

create table if not exists public.referral_events (
  id uuid primary key default gen_random_uuid(),
  referral_code_id uuid not null references public.referral_codes(id) on delete restrict,
  referrer_customer_id uuid not null,
  referred_customer_id uuid not null,
  qualifying_booking_id uuid,
  status text not null default 'PENDING' check (status in ('PENDING','QUALIFIED','REWARDED','REJECTED','REVERSED')),
  rejection_reason text,
  same_device_flag boolean not null default false,
  same_payment_instrument_flag boolean not null default false,
  fraud_risk_level text,
  created_at timestamptz not null default now(),
  qualified_at timestamptz,
  rewarded_at timestamptz,
  unique (referral_code_id, referred_customer_id)
);

create table if not exists public.promotion_credits (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null,
  source_type text not null check (source_type in ('REFERRAL','GOODWILL','CAMPAIGN','BUSINESS')),
  source_reference_id uuid,
  amount numeric(12,2) not null check (amount > 0),
  remaining_amount numeric(12,2) not null check (remaining_amount >= 0),
  expires_at timestamptz,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','USED','EXPIRED','REVERSED')),
  created_at timestamptz not null default now()
);

create index if not exists promotions_status_window_idx on public.promotions(status, starts_at, ends_at);
create index if not exists promotion_redemptions_customer_idx on public.promotion_redemptions(customer_id, created_at desc);
create index if not exists referral_events_referrer_idx on public.referral_events(referrer_customer_id, created_at desc);
create index if not exists referral_events_referred_idx on public.referral_events(referred_customer_id, created_at desc);
create index if not exists promotion_credits_customer_idx on public.promotion_credits(customer_id, status, expires_at);

alter table public.promotions enable row level security;
alter table public.promotion_redemptions enable row level security;
alter table public.referral_codes enable row level security;
alter table public.referral_events enable row level security;
alter table public.promotion_credits enable row level security;

create policy promotions_public_read_active
on public.promotions for select
using (status = 'ACTIVE');

create policy promotion_redemptions_customer_read
on public.promotion_redemptions for select
using (customer_id = auth.uid());

create policy referral_codes_owner_read
on public.referral_codes for select
using (owner_customer_id = auth.uid());

create policy referral_events_participant_read
on public.referral_events for select
using (referrer_customer_id = auth.uid() or referred_customer_id = auth.uid());

create policy promotion_credits_customer_read
on public.promotion_credits for select
using (customer_id = auth.uid());

-- Creation/redemption/reward mutation stays server-side so clients cannot mint discounts or credits.
