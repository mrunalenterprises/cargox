-- CargoX clean-start DESIGN MIGRATION. NOT applied to any database.
-- Review by security counsel and run in isolated staging before deployment.
create extension if not exists pgcrypto;
create table public.cities (
 id uuid primary key default gen_random_uuid(),
 name text not null unique,
 timezone text not null,
 is_active boolean not null default false,
 created_at timestamptz not null default now()
);
create table public.city_services (
 city_id uuid not null references public.cities(id),
 service text not null check(service in ('bike','auto','car','outstation','shared')),
 enabled boolean not null default false,
 legal_ready boolean not null default false,
 primary key(city_id,service)
);
create table public.profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text,
 role text not null default 'customer'
   check(role in ('customer','driver','owner','fleet','agency','super_admin','gm','accounts','field_officer')),
 created_at timestamptz not null default now()
);
create table public.partners (
 user_id uuid primary key references public.profiles(user_id) on delete cascade,
 city_id uuid references public.cities(id),
 staff_verified boolean not null default false,
 admin_approved boolean not null default false,
 police_verified boolean not null default false,
 insurance_valid_until timestamptz,
 documents_valid_until timestamptz,
 identity_verified boolean not null default false,
 verified_woman boolean not null default false,
 pink_opt_in boolean not null default false,
 pink_mode text not null default 'women_only' check(pink_mode in ('women_only','all')),
 online boolean not null default false,
 created_at timestamptz not null default now()
);
create table public.rides (
 id uuid primary key default gen_random_uuid(),
 customer_id uuid not null references public.profiles(user_id),
 partner_id uuid references public.partners(user_id),
 city_id uuid not null references public.cities(id),
 service text not null check(service in ('bike','auto','car','outstation','shared')),
 mode text not null check(mode in ('now','schedule','daily','monthly')),
 state text not null default 'requested' check(state in
 ('quoted','requested','matching','assigned','arrived','otp_verified','in_progress','completed','cancelled','expired','incident')),
 pickup_label text not null,
 drop_label text not null,
 scheduled_for timestamptz,
 pink_only boolean not null default false,
 verified_women_party boolean not null default false,
 fare_paise bigint not null check(fare_paise>=0),
 currency char(3) not null default 'INR',
 quote_json jsonb not null,
 created_at timestamptz not null default now()
);
create index rides_partner_state_idx on public.rides(partner_id,state);
create index rides_customer_created_idx on public.rides(customer_id,created_at desc);
create table public.monthly_packs (
 id uuid primary key default gen_random_uuid(),
 customer_id uuid not null references public.profiles(user_id),
 city_id uuid not null references public.cities(id),
 service text not null check(service in ('bike','auto','car','outstation','shared')),
 pickup_label text not null,
 drop_label text not null,
 weekdays int[] not null,
 pickup_local_time time not null,
 return_local_time time,
 starts_on date not null,
 ends_on date not null,
 pink_only boolean not null default false,
 total_paise bigint not null check(total_paise>=0),
 status text not null default 'draft' check(status in ('draft','awaiting_payment','active','paused','completed','cancelled')),
 pricing_snapshot jsonb not null,
 created_at timestamptz not null default now(),
 constraint monthly_pack_order check(ends_on>=starts_on)
);
create table public.ride_occurrences (
 id uuid primary key default gen_random_uuid(),
 pack_id uuid not null references public.monthly_packs(id) on delete restrict,
 ride_id uuid unique references public.rides(id),
 occurrence_date date not null,
 pickup_local_time time not null,
 leg text not null check(leg in ('outbound','return')),
 status text not null default 'pending' check(status in ('pending','matching','assigned','completed','skipped','cancelled')),
 unique(pack_id,occurrence_date,leg)
);
create table public.trip_start_secrets (
 ride_id uuid primary key references public.rides(id) on delete cascade,
 otp_hash bytea not null,
 otp_salt bytea not null,
 expires_at timestamptz not null,
 attempts int not null default 0 check(attempts between 0 and 6)
);
create table public.payment_events (
 id uuid primary key default gen_random_uuid(),
 external_event_id text not null unique,
 provider text not null,
 event_type text not null,
 verified_at timestamptz,
 payload jsonb not null,
 processed_at timestamptz
);
create table public.ledger_entries (
 id uuid primary key default gen_random_uuid(),
 ride_id uuid references public.rides(id),
 pack_id uuid references public.monthly_packs(id),
 entry_type text not null,
 amount_paise bigint not null,
 currency char(3) not null default 'INR',
 external_ref text unique,
 created_at timestamptz not null default now()
);
create table public.incidents (
 id uuid primary key default gen_random_uuid(),
 ride_id uuid not null references public.rides(id),
 reporter_id uuid not null references public.profiles(user_id),
 category text not null,
 description text not null,
 resolution_state text not null default 'open',
 created_at timestamptz not null default now()
);
create table public.audit_events (
 id uuid primary key default gen_random_uuid(),
 actor_id uuid references public.profiles(user_id),
 event_type text not null,
 entity_type text not null,
 entity_id uuid,
 details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
-- Explicit RLS, default-deny. No blanket client INSERT/UPDATE of operational state.
alter table public.cities enable row level security;
alter table public.city_services enable row level security;
alter table public.profiles enable row level security;
alter table public.partners enable row level security;
alter table public.rides enable row level security;
alter table public.monthly_packs enable row level security;
alter table public.ride_occurrences enable row level security;
alter table public.trip_start_secrets enable row level security;
alter table public.payment_events enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.incidents enable row level security;
alter table public.audit_events enable row level security;
create policy "authenticated cities catalog" on public.cities for select to authenticated using (true);
create policy "authenticated service catalog" on public.city_services for select to authenticated using (true);
create policy "read own profile" on public.profiles for select to authenticated using (user_id=auth.uid());
create policy "customer initial profile" on public.profiles for insert to authenticated with check (user_id=auth.uid() and role='customer');
create policy "partner read own" on public.partners for select to authenticated using (user_id=auth.uid());
create policy "customer or assigned partner read ride" on public.rides for select to authenticated
 using (customer_id=auth.uid() or partner_id=auth.uid());
create policy "customer read own plans" on public.monthly_packs for select to authenticated using(customer_id=auth.uid());
create policy "customer read own occurrences" on public.ride_occurrences for select to authenticated
 using (exists(select 1 from public.monthly_packs p where p.id=pack_id and p.customer_id=auth.uid()));
create policy "reporter read own incidents" on public.incidents for select to authenticated using(reporter_id=auth.uid());
-- Production Edge Functions need independently verified JWT/role before server-side service-role writes.
revoke all on public.trip_start_secrets from anon,authenticated;
revoke all on public.payment_events from anon,authenticated;
revoke all on public.ledger_entries from anon,authenticated;
revoke all on public.audit_events from anon,authenticated;
