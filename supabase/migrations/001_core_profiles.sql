create extension if not exists pgcrypto;

create table if not exists public.customer_profiles (
  user_id uuid primary key,
  full_name text,
  mobile text,
  email text,
  city_code text,
  reliability_score smallint not null default 78 check (reliability_score between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.partner_profiles (
  user_id uuid primary key,
  full_name text,
  mobile text,
  email text,
  city_code text,
  status text not null default 'PENDING' check (status in ('PENDING','ACTIVE','SUSPENDED','REJECTED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.customer_profiles enable row level security;
alter table public.partner_profiles enable row level security;

create policy "customer_read_own_profile" on public.customer_profiles for select using (auth.uid() = user_id);
create policy "customer_update_own_profile" on public.customer_profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "partner_read_own_profile" on public.partner_profiles for select using (auth.uid() = user_id);
create policy "partner_update_own_profile" on public.partner_profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
