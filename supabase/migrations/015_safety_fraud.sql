create table if not exists public.trip_share_links (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null,
  created_by uuid not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.sos_incidents (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid,
  raised_by uuid not null,
  source text not null check (source in ('customer','partner','admin')),
  reason text not null,
  severity text not null check (severity in ('INFO','HIGH','CRITICAL')),
  latitude numeric(10,7),
  longitude numeric(10,7),
  status text not null default 'OPEN' check (status in ('OPEN','ACKNOWLEDGED','ESCALATED','RESOLVED','CLOSED')),
  assigned_to uuid,
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.safety_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid,
  actor_id uuid,
  event_type text not null,
  severity text not null default 'LOW' check (severity in ('LOW','MEDIUM','HIGH','CRITICAL')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.fraud_risk_snapshots (
  subject_type text not null check (subject_type in ('customer','partner','vehicle','booking','device','payment')),
  subject_id text not null,
  risk_score smallint not null check (risk_score between 0 and 100),
  risk_level text not null check (risk_level in ('LOW','MEDIUM','HIGH','CRITICAL')),
  decision text not null check (decision in ('ALLOW','LIMIT_AND_MONITOR','MANUAL_REVIEW','BLOCK_AND_REVIEW')),
  signals jsonb not null default '{}'::jsonb,
  calculated_at timestamptz not null default now(),
  primary key (subject_type, subject_id)
);

create table if not exists public.fraud_review_cases (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null,
  subject_id text not null,
  booking_id uuid,
  status text not null default 'OPEN' check (status in ('OPEN','IN_REVIEW','CLEARED','CONFIRMED','CLOSED')),
  assigned_to uuid,
  reason text not null,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

alter table public.trip_share_links enable row level security;
alter table public.sos_incidents enable row level security;
alter table public.safety_events enable row level security;
alter table public.fraud_risk_snapshots enable row level security;
alter table public.fraud_review_cases enable row level security;

create policy "share_link_creator_read" on public.trip_share_links for select using (auth.uid() = created_by);
create policy "share_link_creator_insert" on public.trip_share_links for insert with check (auth.uid() = created_by);
create policy "sos_raiser_read" on public.sos_incidents for select using (auth.uid() = raised_by);
create policy "sos_raiser_insert" on public.sos_incidents for insert with check (auth.uid() = raised_by);

create index if not exists sos_incidents_status_severity_idx on public.sos_incidents(status, severity, created_at desc);
create index if not exists safety_events_booking_created_idx on public.safety_events(booking_id, created_at desc);
create index if not exists fraud_risk_level_idx on public.fraud_risk_snapshots(risk_level, risk_score desc);
create index if not exists fraud_review_status_idx on public.fraud_review_cases(status, created_at desc);
