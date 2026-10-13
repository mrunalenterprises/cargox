-- LOADIN finance reconciliation engine. Detects booking/payment/settlement mismatches before launch and during operations.

create table if not exists public.finance_reconciliation_runs (
  id uuid primary key default gen_random_uuid(),
  scope_from timestamptz not null,
  scope_to timestamptz not null,
  status text not null default 'RUNNING' check (status in ('RUNNING','COMPLETED')),
  summary jsonb not null default '{}'::jsonb,
  created_by uuid,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.finance_reconciliation_issues (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.finance_reconciliation_runs(id) on delete cascade,
  issue_type text not null,
  severity text not null check (severity in ('P0','P1','P2','P3')),
  city_code text,
  booking_id uuid references public.bookings(id) on delete set null,
  partner_id uuid,
  payment_id uuid references public.customer_payments(id) on delete set null,
  expected_amount numeric(12,2),
  actual_amount numeric(12,2),
  details jsonb not null default '{}'::jsonb,
  status text not null default 'OPEN' check (status in ('OPEN','RESOLVED','IGNORED')),
  resolution_notes text,
  resolved_by uuid,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table public.finance_reconciliation_runs enable row level security;
alter table public.finance_reconciliation_issues enable row level security;

create index if not exists finance_reconciliation_runs_started_idx on public.finance_reconciliation_runs(started_at desc);
create index if not exists finance_reconciliation_issues_status_idx on public.finance_reconciliation_issues(status,severity,created_at desc);
create index if not exists finance_reconciliation_issues_booking_idx on public.finance_reconciliation_issues(booking_id,created_at desc);

create or replace function public.run_loadin_finance_reconciliation(
  p_from timestamptz default (now() - interval '7 days'),
  p_to timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_from timestamptz := coalesce(p_from,now()-interval '7 days');
  v_to timestamptz := coalesce(p_to,now());
  v_run_id uuid;
  v_open integer;
  v_p0 integer;
  v_p1 integer;
  v_expected numeric(14,2);
  v_actual numeric(14,2);
begin
  if v_to <= v_from then raise exception 'invalid_reconciliation_window' using errcode='22023'; end if;
  if v_to - v_from > interval '31 days' then raise exception 'reconciliation_window_too_large' using errcode='22023'; end if;

  insert into public.finance_reconciliation_runs(scope_from,scope_to,status)
  values(v_from,v_to,'RUNNING') returning id into v_run_id;

  -- Completed booking must always have exactly one settlement row.
  insert into public.finance_reconciliation_issues(run_id,issue_type,severity,city_code,booking_id,partner_id,expected_amount,actual_amount,details)
  select v_run_id,'COMPLETED_MISSING_SETTLEMENT','P0',b.city_code,b.id,b.partner_id,b.locked_fare,0,
    jsonb_build_object('payment_mode',b.customer_payment_mode,'completed_at',b.completed_at)
  from public.bookings b
  where b.status='COMPLETED'
    and coalesce(b.completed_at,b.updated_at) >= v_from
    and coalesce(b.completed_at,b.updated_at) < v_to
    and not exists(select 1 from public.booking_partner_settlements s where s.booking_id=b.id);

  -- Online completed booking must have enough confirmed customer payment.
  insert into public.finance_reconciliation_issues(run_id,issue_type,severity,city_code,booking_id,partner_id,payment_id,expected_amount,actual_amount,details)
  select v_run_id,'ONLINE_PAYMENT_NOT_COVERING_FARE','P0',b.city_code,b.id,b.partner_id,
    p.id,b.locked_fare,coalesce(p.amount,0),jsonb_build_object('payment_status',p.status,'provider',p.provider)
  from public.bookings b
  left join lateral (
    select cp.* from public.customer_payments cp
    where cp.booking_id=b.id and cp.customer_id=b.customer_id and cp.status='PAID'
    order by cp.paid_at desc nulls last,cp.created_at desc limit 1
  ) p on true
  where b.status='COMPLETED' and b.customer_payment_mode='ONLINE'
    and coalesce(b.completed_at,b.updated_at) >= v_from
    and coalesce(b.completed_at,b.updated_at) < v_to
    and (p.id is null or coalesce(p.amount,0) < b.locked_fare);

  -- Settlement fare must exactly match Fare Lock snapshot stored on booking.
  insert into public.finance_reconciliation_issues(run_id,issue_type,severity,city_code,booking_id,partner_id,expected_amount,actual_amount,details)
  select v_run_id,'SETTLEMENT_FARE_MISMATCH','P1',b.city_code,b.id,s.partner_id,b.locked_fare,s.commissionable_fare,
    jsonb_build_object('plan',s.plan,'settlement_mode',s.settlement_mode,'status',s.status)
  from public.booking_partner_settlements s
  join public.bookings b on b.id=s.booking_id
  where s.created_at >= v_from and s.created_at < v_to
    and round(s.commissionable_fare,2) is distinct from round(b.locked_fare,2);

  -- Locked commission rules: Commission=15%, Subscription=0%.
  insert into public.finance_reconciliation_issues(run_id,issue_type,severity,city_code,booking_id,partner_id,expected_amount,actual_amount,details)
  select v_run_id,'COMMISSION_AMOUNT_MISMATCH','P1',b.city_code,b.id,s.partner_id,
    case when s.plan='COMMISSION' then round(s.commissionable_fare*0.15,2) else 0 end,
    s.commission_amount,jsonb_build_object('plan',s.plan,'rate_pct',s.commission_rate_pct)
  from public.booking_partner_settlements s
  join public.bookings b on b.id=s.booking_id
  where s.created_at >= v_from and s.created_at < v_to
    and round(s.commission_amount,2) is distinct from round(case when s.plan='COMMISSION' then s.commissionable_fare*0.15 else 0 end,2);

  -- Partner entitlement must be gross minus LOADIN commission.
  insert into public.finance_reconciliation_issues(run_id,issue_type,severity,city_code,booking_id,partner_id,expected_amount,actual_amount,details)
  select v_run_id,'PARTNER_ENTITLEMENT_MISMATCH','P1',b.city_code,b.id,s.partner_id,
    round(s.commissionable_fare-s.commission_amount,2),s.partner_entitlement,
    jsonb_build_object('plan',s.plan,'commission',s.commission_amount)
  from public.booking_partner_settlements s
  join public.bookings b on b.id=s.booking_id
  where s.created_at >= v_from and s.created_at < v_to
    and round(s.partner_entitlement,2) is distinct from round(s.commissionable_fare-s.commission_amount,2);

  -- Cash/direct-UPI commission settlements should have a matching commission balance event.
  insert into public.finance_reconciliation_issues(run_id,issue_type,severity,city_code,booking_id,partner_id,expected_amount,actual_amount,details)
  select v_run_id,'COMMISSION_DEBIT_EVENT_MISSING','P1',b.city_code,b.id,s.partner_id,s.commission_amount,0,
    jsonb_build_object('settlement_mode',s.settlement_mode)
  from public.booking_partner_settlements s
  join public.bookings b on b.id=s.booking_id
  where s.created_at >= v_from and s.created_at < v_to
    and s.plan='COMMISSION' and s.settlement_mode='COMMISSION_BALANCE_DEBIT'
    and s.commission_amount>0
    and not exists(
      select 1 from public.partner_balance_events e
      where e.booking_id=s.booking_id and e.partner_id=s.partner_id and e.bucket='COMMISSION' and e.direction='DEBIT'
        and round(e.amount,2)=round(s.commission_amount,2)
    );

  -- Online/platform payouts should have a matching earnings credit event.
  insert into public.finance_reconciliation_issues(run_id,issue_type,severity,city_code,booking_id,partner_id,expected_amount,actual_amount,details)
  select v_run_id,'EARNINGS_CREDIT_EVENT_MISSING','P1',b.city_code,b.id,s.partner_id,s.partner_entitlement,0,
    jsonb_build_object('settlement_mode',s.settlement_mode)
  from public.booking_partner_settlements s
  join public.bookings b on b.id=s.booking_id
  where s.created_at >= v_from and s.created_at < v_to
    and s.settlement_mode='PLATFORM_PAYOUT' and s.partner_entitlement>0
    and not exists(
      select 1 from public.partner_balance_events e
      where e.booking_id=s.booking_id and e.partner_id=s.partner_id and e.bucket='EARNINGS' and e.direction='CREDIT'
        and round(e.amount,2)=round(s.partner_entitlement,2)
    );

  select count(*) filter(where status='OPEN'),count(*) filter(where status='OPEN' and severity='P0'),count(*) filter(where status='OPEN' and severity='P1')
  into v_open,v_p0,v_p1 from public.finance_reconciliation_issues where run_id=v_run_id;

  select coalesce(sum(b.locked_fare),0),coalesce(sum(s.commissionable_fare),0)
  into v_expected,v_actual
  from public.bookings b
  left join public.booking_partner_settlements s on s.booking_id=b.id
  where b.status='COMPLETED' and coalesce(b.completed_at,b.updated_at)>=v_from and coalesce(b.completed_at,b.updated_at)<v_to;

  update public.finance_reconciliation_runs
  set status='COMPLETED',completed_at=now(),summary=jsonb_build_object(
    'openIssues',v_open,'p0',v_p0,'p1',v_p1,
    'completedFare',v_expected,'settledFare',v_actual,
    'scopeFrom',v_from,'scopeTo',v_to
  ) where id=v_run_id;

  return jsonb_build_object('run_id',v_run_id,'status','COMPLETED','openIssues',v_open,'p0',v_p0,'p1',v_p1,'completedFare',v_expected,'settledFare',v_actual);
end
$$;

create or replace function public.loadin_admin_finance_reconciliation_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member public.admin_members;
  v_city text;
  v_run jsonb;
  v_issues jsonb;
begin
  v_member := public.require_loadin_admin(array['SUPER_ADMIN','ACCOUNTS']);
  v_city := v_member.city_code;

  select to_jsonb(r) into v_run from public.finance_reconciliation_runs r order by r.started_at desc limit 1;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',i.id,'run_id',i.run_id,'issue_type',i.issue_type,'severity',i.severity,'city_code',i.city_code,
    'booking_id',i.booking_id,'partner_id',i.partner_id,'payment_id',i.payment_id,
    'expected_amount',i.expected_amount,'actual_amount',i.actual_amount,'status',i.status,
    'details',i.details,'resolution_notes',i.resolution_notes,'created_at',i.created_at,'resolved_at',i.resolved_at
  ) order by i.created_at desc),'[]'::jsonb)
  into v_issues
  from (select * from public.finance_reconciliation_issues x
        where (v_member.role='SUPER_ADMIN' or v_city is null or x.city_code=v_city)
        order by x.created_at desc limit 200) i;

  return jsonb_build_object('role',v_member.role,'cityCode',v_member.city_code,'latestRun',v_run,'issues',v_issues);
end
$$;

create or replace function public.loadin_admin_run_finance_reconciliation(p_hours integer default 168)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.require_loadin_admin(array['SUPER_ADMIN','ACCOUNTS']);
  if p_hours < 1 or p_hours > 744 then raise exception 'invalid_reconciliation_hours' using errcode='22023'; end if;
  return public.run_loadin_finance_reconciliation(now()-(p_hours||' hours')::interval,now());
end
$$;

create or replace function public.loadin_admin_resolve_reconciliation_issue(
  p_issue_id uuid,
  p_status text default 'RESOLVED',
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member public.admin_members;
  v_issue public.finance_reconciliation_issues;
  v_status text := upper(trim(coalesce(p_status,'')));
begin
  v_member := public.require_loadin_admin(array['SUPER_ADMIN','ACCOUNTS']);
  if v_status not in ('RESOLVED','IGNORED') then raise exception 'invalid_reconciliation_resolution' using errcode='22023'; end if;
  select * into v_issue from public.finance_reconciliation_issues where id=p_issue_id for update;
  if not found then raise exception 'reconciliation_issue_not_found' using errcode='P0002'; end if;
  if v_member.role<>'SUPER_ADMIN' and v_member.city_code is not null and v_issue.city_code is distinct from v_member.city_code then
    raise exception 'admin_city_scope_denied' using errcode='42501';
  end if;

  update public.finance_reconciliation_issues set status=v_status,resolution_notes=nullif(trim(coalesce(p_notes,'')),''),resolved_by=v_member.user_id,resolved_at=now()
  where id=p_issue_id returning * into v_issue;

  insert into public.admin_audit_log(actor_user_id,actor_role,action,entity_type,entity_id,after_data,reason)
  values(v_member.user_id,v_member.role,'RESOLVE_FINANCE_RECONCILIATION','FINANCE_RECONCILIATION_ISSUE',p_issue_id::text,to_jsonb(v_issue),p_notes);

  return jsonb_build_object('id',v_issue.id,'status',v_issue.status,'resolved_at',v_issue.resolved_at);
end
$$;

revoke all on function public.run_loadin_finance_reconciliation(timestamptz,timestamptz) from public,anon,authenticated;
revoke all on function public.loadin_admin_finance_reconciliation_snapshot() from public,anon;
revoke all on function public.loadin_admin_run_finance_reconciliation(integer) from public,anon;
revoke all on function public.loadin_admin_resolve_reconciliation_issue(uuid,text,text) from public,anon;

grant execute on function public.run_loadin_finance_reconciliation(timestamptz,timestamptz) to service_role;
grant execute on function public.loadin_admin_finance_reconciliation_snapshot() to authenticated,service_role;
grant execute on function public.loadin_admin_run_finance_reconciliation(integer) to authenticated,service_role;
grant execute on function public.loadin_admin_resolve_reconciliation_issue(uuid,text,text) to authenticated,service_role;
