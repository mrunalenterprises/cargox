create table if not exists public.support_sla_policies (
  id uuid primary key default gen_random_uuid(),
  priority text not null check (priority in ('P0','P1','P2','P3')),
  first_response_minutes integer not null check (first_response_minutes >= 0),
  gm_escalation_minutes integer not null check (gm_escalation_minutes >= 0),
  super_admin_escalation_minutes integer not null check (super_admin_escalation_minutes >= 0),
  resolution_minutes integer not null check (resolution_minutes >= 0),
  active boolean not null default true,
  effective_from timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (priority, effective_from)
);

create table if not exists public.support_sla_states (
  id uuid primary key default gen_random_uuid(),
  support_case_id uuid not null,
  customer_id uuid,
  partner_id uuid,
  priority text not null check (priority in ('P0','P1','P2','P3')),
  current_owner_role text not null default 'SUPPORT' check (current_owner_role in ('SUPPORT','GM','SUPER_ADMIN','SAFETY')),
  opened_at timestamptz not null,
  first_response_at timestamptz,
  resolved_at timestamptz,
  first_response_due_at timestamptz not null,
  gm_escalate_at timestamptz not null,
  super_admin_escalate_at timestamptz not null,
  resolution_due_at timestamptz not null,
  response_breached boolean not null default false,
  resolution_breached boolean not null default false,
  safety_priority boolean not null default false,
  active_trip_priority boolean not null default false,
  last_escalated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (support_case_id)
);

create index if not exists support_sla_states_priority_idx on public.support_sla_states (priority, resolved_at);
create index if not exists support_sla_states_gm_due_idx on public.support_sla_states (gm_escalate_at) where resolved_at is null;
create index if not exists support_sla_states_super_due_idx on public.support_sla_states (super_admin_escalate_at) where resolved_at is null;
create index if not exists support_sla_states_resolution_due_idx on public.support_sla_states (resolution_due_at) where resolved_at is null;
create index if not exists support_sla_states_customer_idx on public.support_sla_states (customer_id) where customer_id is not null;
create index if not exists support_sla_states_partner_idx on public.support_sla_states (partner_id) where partner_id is not null;

create table if not exists public.support_escalation_events (
  id uuid primary key default gen_random_uuid(),
  support_case_id uuid not null,
  from_role text check (from_role in ('SUPPORT','GM','SUPER_ADMIN','SAFETY')),
  to_role text not null check (to_role in ('SUPPORT','GM','SUPER_ADMIN','SAFETY')),
  reason text not null,
  automated boolean not null default true,
  actor_user_id uuid,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists support_escalation_events_case_idx on public.support_escalation_events (support_case_id, created_at desc);
create index if not exists support_escalation_events_role_idx on public.support_escalation_events (to_role, created_at desc);

alter table public.support_sla_policies enable row level security;
alter table public.support_sla_states enable row level security;
alter table public.support_escalation_events enable row level security;

create policy "Authenticated users can read active support SLA policies"
  on public.support_sla_policies for select
  to authenticated
  using (active = true);

create policy "Customers can read their own support SLA state"
  on public.support_sla_states for select
  to authenticated
  using (customer_id = auth.uid());

create policy "Partners can read their own support SLA state"
  on public.support_sla_states for select
  to authenticated
  using (partner_id = auth.uid());

create policy "Customers can read escalation events for their support cases"
  on public.support_escalation_events for select
  to authenticated
  using (
    exists (
      select 1 from public.support_sla_states s
      where s.support_case_id = support_escalation_events.support_case_id
        and s.customer_id = auth.uid()
    )
  );

create policy "Partners can read escalation events for their support cases"
  on public.support_escalation_events for select
  to authenticated
  using (
    exists (
      select 1 from public.support_sla_states s
      where s.support_case_id = support_escalation_events.support_case_id
        and s.partner_id = auth.uid()
    )
  );

insert into public.support_sla_policies (priority, first_response_minutes, gm_escalation_minutes, super_admin_escalation_minutes, resolution_minutes)
select * from (values
  ('P0', 2, 5, 10, 30),
  ('P1', 5, 15, 30, 120),
  ('P2', 15, 60, 180, 480),
  ('P3', 60, 240, 720, 1440)
) as v(priority, first_response_minutes, gm_escalation_minutes, super_admin_escalation_minutes, resolution_minutes)
where not exists (select 1 from public.support_sla_policies p where p.priority = v.priority and p.active = true);
