create table if not exists public.partner_reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null,
  customer_id uuid not null,
  partner_id uuid not null,
  vehicle_id uuid,
  stars smallint not null check (stars between 1 and 5),
  comment text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (booking_id, customer_id)
);

create table if not exists public.partner_quality_snapshots (
  partner_id uuid primary key,
  average_rating numeric(3,2) not null default 0,
  completed_trips integer not null default 0,
  on_time_rate numeric(5,2) not null default 0,
  post_accept_cancellation_rate numeric(5,2) not null default 0,
  damage_free_rate numeric(5,2) not null default 100,
  complaint_rate numeric(5,2) not null default 0,
  repeat_customer_rate numeric(5,2) not null default 0,
  recent_performance numeric(5,2) not null default 50,
  quality_score smallint not null default 50 check (quality_score between 0 and 100),
  booking_priority text not null default 'NORMAL' check (booking_priority in ('HIGH','NORMAL','LOW','RESTRICTED')),
  ai_review_summary jsonb not null default '{}'::jsonb,
  calculated_at timestamptz not null default now()
);

alter table public.partner_reviews enable row level security;
alter table public.partner_quality_snapshots enable row level security;

create policy "customer_read_own_reviews" on public.partner_reviews
for select using (auth.uid() = customer_id);
create policy "customer_insert_own_review" on public.partner_reviews
for insert with check (auth.uid() = customer_id);

create policy "authenticated_read_partner_quality" on public.partner_quality_snapshots
for select to authenticated using (true);

create index if not exists partner_reviews_partner_created_idx on public.partner_reviews(partner_id, created_at desc);
create index if not exists partner_quality_score_idx on public.partner_quality_snapshots(quality_score desc);
