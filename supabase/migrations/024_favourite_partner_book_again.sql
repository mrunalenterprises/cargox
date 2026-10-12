create table if not exists public.customer_favourite_partners (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null,
  partner_id uuid not null,
  service_type text,
  vehicle_id uuid,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(customer_id, partner_id, service_type)
);

create index if not exists customer_favourite_partners_customer_idx
  on public.customer_favourite_partners(customer_id, active);
create index if not exists customer_favourite_partners_partner_idx
  on public.customer_favourite_partners(partner_id, active);

create table if not exists public.customer_partner_history (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null,
  partner_id uuid not null,
  completed_trips integer not null default 0 check (completed_trips >= 0),
  last_completed_booking_id uuid,
  last_completed_at timestamptz,
  average_customer_rating numeric(3,2),
  updated_at timestamptz not null default now(),
  unique(customer_id, partner_id)
);

create index if not exists customer_partner_history_customer_idx
  on public.customer_partner_history(customer_id, completed_trips desc);
create index if not exists customer_partner_history_partner_idx
  on public.customer_partner_history(partner_id, completed_trips desc);

create table if not exists public.book_again_requests (
  id uuid primary key default gen_random_uuid(),
  source_booking_id uuid not null,
  customer_id uuid not null,
  preferred_partner_id uuid,
  preferred_vehicle_id uuid,
  service_type text not null,
  pickup jsonb not null,
  drop_location jsonb not null,
  goods_summary jsonb,
  helper_required boolean not null default false,
  schedule_at timestamptz,
  pricing_mode text not null default 'REPRICE_REQUIRED' check (pricing_mode in ('REPRICE_REQUIRED')),
  generated_booking_id uuid,
  status text not null default 'PENDING' check (status in ('PENDING','MATCHING','BOOKED','EXPIRED','CANCELLED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists book_again_requests_customer_status_idx
  on public.book_again_requests(customer_id, status, created_at desc);
create index if not exists book_again_requests_partner_status_idx
  on public.book_again_requests(preferred_partner_id, status, created_at desc);

create table if not exists public.preferred_partner_match_events (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null,
  booking_id uuid,
  candidate_partner_id uuid not null,
  is_favourite boolean not null default false,
  is_book_again boolean not null default false,
  completed_trips_together integer not null default 0,
  partner_quality_score numeric(5,2),
  distance_km numeric(8,2),
  match_score numeric(5,2) not null,
  eligible boolean not null default true,
  rejection_reason text,
  created_at timestamptz not null default now()
);

create index if not exists preferred_partner_match_booking_idx
  on public.preferred_partner_match_events(booking_id, match_score desc);
create index if not exists preferred_partner_match_customer_idx
  on public.preferred_partner_match_events(customer_id, created_at desc);

alter table public.customer_favourite_partners enable row level security;
alter table public.customer_partner_history enable row level security;
alter table public.book_again_requests enable row level security;
alter table public.preferred_partner_match_events enable row level security;

create policy customer_favourite_partners_select_own
  on public.customer_favourite_partners for select
  using (auth.uid() = customer_id);
create policy customer_favourite_partners_insert_own
  on public.customer_favourite_partners for insert
  with check (auth.uid() = customer_id);
create policy customer_favourite_partners_update_own
  on public.customer_favourite_partners for update
  using (auth.uid() = customer_id)
  with check (auth.uid() = customer_id);
create policy customer_favourite_partners_delete_own
  on public.customer_favourite_partners for delete
  using (auth.uid() = customer_id);

create policy customer_partner_history_select_customer
  on public.customer_partner_history for select
  using (auth.uid() = customer_id);
create policy customer_partner_history_select_partner
  on public.customer_partner_history for select
  using (auth.uid() = partner_id);

create policy book_again_requests_select_own
  on public.book_again_requests for select
  using (auth.uid() = customer_id);
create policy book_again_requests_insert_own
  on public.book_again_requests for insert
  with check (auth.uid() = customer_id);
create policy book_again_requests_update_own
  on public.book_again_requests for update
  using (auth.uid() = customer_id)
  with check (auth.uid() = customer_id);

create policy preferred_partner_match_events_select_customer
  on public.preferred_partner_match_events for select
  using (auth.uid() = customer_id);
create policy preferred_partner_match_events_select_partner
  on public.preferred_partner_match_events for select
  using (auth.uid() = candidate_partner_id);

-- History rollups, match-event writes and generated booking links are intended for trusted server-side logic.
