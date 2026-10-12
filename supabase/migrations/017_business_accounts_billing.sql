create table if not exists public.business_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  legal_name text not null,
  trade_name text,
  gstin text,
  billing_email text,
  billing_phone text,
  billing_address jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business_accounts(id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('OWNER','ADMIN','BOOKER','VIEWER')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (business_id, user_id)
);

create table if not exists public.business_booking_links (
  business_id uuid not null references public.business_accounts(id) on delete cascade,
  booking_id uuid not null,
  booked_by_user_id uuid not null,
  cost_center text,
  employee_code text,
  purpose text,
  created_at timestamptz not null default now(),
  primary key (business_id, booking_id)
);

create table if not exists public.business_statements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business_accounts(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  booking_count integer not null default 0,
  gross_fare numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  credits numeric(12,2) not null default 0,
  debits numeric(12,2) not null default 0,
  amount_due numeric(12,2) not null default 0,
  status text not null default 'draft' check (status in ('draft','issued','paid','void')),
  issued_at timestamptz,
  created_at timestamptz not null default now(),
  unique (business_id, period_start, period_end)
);

alter table public.business_accounts enable row level security;
alter table public.business_members enable row level security;
alter table public.business_booking_links enable row level security;
alter table public.business_statements enable row level security;

create policy "business_owner_read_account" on public.business_accounts
for select using (auth.uid() = owner_user_id);
create policy "business_owner_update_account" on public.business_accounts
for update using (auth.uid() = owner_user_id);

create policy "business_member_read_members" on public.business_members
for select using (
  user_id = auth.uid() or exists (
    select 1 from public.business_accounts b where b.id = business_id and b.owner_user_id = auth.uid()
  )
);

create policy "business_owner_manage_members" on public.business_members
for all using (
  exists (select 1 from public.business_accounts b where b.id = business_id and b.owner_user_id = auth.uid())
)
with check (
  exists (select 1 from public.business_accounts b where b.id = business_id and b.owner_user_id = auth.uid())
);

create policy "business_member_read_booking_links" on public.business_booking_links
for select using (
  exists (select 1 from public.business_members m where m.business_id = business_booking_links.business_id and m.user_id = auth.uid() and m.is_active)
  or exists (select 1 from public.business_accounts b where b.id = business_booking_links.business_id and b.owner_user_id = auth.uid())
);

create policy "business_member_read_statements" on public.business_statements
for select using (
  exists (select 1 from public.business_members m where m.business_id = business_statements.business_id and m.user_id = auth.uid() and m.is_active)
  or exists (select 1 from public.business_accounts b where b.id = business_statements.business_id and b.owner_user_id = auth.uid())
);

create index if not exists business_members_business_role_idx on public.business_members(business_id, role, is_active);
create index if not exists business_booking_links_business_created_idx on public.business_booking_links(business_id, created_at desc);
create index if not exists business_statements_business_period_idx on public.business_statements(business_id, period_start desc);
