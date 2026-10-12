-- Customer support creation through an auth-scoped RPC.
-- Keeps one open case per booking and translates UI P0-P3 priorities to persisted SLA levels.

create or replace function public.open_customer_support_case(
  p_booking_id uuid,
  p_category text,
  p_priority text default 'P2',
  p_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_booking public.bookings;
  v_case public.support_cases;
  v_priority_ui text := upper(trim(coalesce(p_priority,'P2')));
  v_priority_db text;
  v_category text := upper(trim(coalesce(p_category,'GENERAL')));
  v_owner text;
begin
  if v_uid is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select * into v_booking
  from public.bookings
  where id = p_booking_id
  for update;

  if not found or v_booking.customer_id is distinct from v_uid then
    raise exception 'booking_not_owned_by_customer' using errcode = '42501';
  end if;

  v_priority_db := case v_priority_ui
    when 'P0' then 'URGENT'
    when 'P1' then 'HIGH'
    when 'P2' then 'NORMAL'
    when 'P3' then 'LOW'
    when 'URGENT' then 'URGENT'
    when 'HIGH' then 'HIGH'
    when 'NORMAL' then 'NORMAL'
    when 'LOW' then 'LOW'
    else null
  end;

  if v_priority_db is null then
    raise exception 'invalid_support_priority' using errcode = '22023';
  end if;

  select * into v_case
  from public.support_cases
  where booking_id = p_booking_id
    and status not in ('RESOLVED','CLOSED')
  order by created_at desc
  limit 1;

  if found then
    insert into public.support_case_events(case_id, actor_id, actor_role, event_type, note, metadata)
    values (
      v_case.id,
      v_uid,
      'CUSTOMER',
      'CUSTOMER_FOLLOWUP',
      nullif(trim(coalesce(p_message,'')),''),
      jsonb_build_object('requested_priority',v_priority_ui,'category',v_category)
    );
  else
    insert into public.support_cases(
      booking_id, customer_id, partner_id, category, status, priority,
      active_trip_escalation, safety_risk, created_at, updated_at
    ) values (
      p_booking_id,
      v_uid,
      v_booking.partner_id,
      v_category,
      'OPEN',
      v_priority_db,
      v_booking.status not in ('COMPLETED','CANCELLED','FAILED') and v_priority_ui in ('P0','P1'),
      v_priority_ui = 'P0' or v_category in ('SAFETY','SOS'),
      now(),
      now()
    )
    returning * into v_case;

    insert into public.support_case_events(case_id, actor_id, actor_role, event_type, note, metadata)
    values (
      v_case.id,
      v_uid,
      'CUSTOMER',
      'CASE_CREATED',
      nullif(trim(coalesce(p_message,'')),''),
      jsonb_build_object('requested_priority',v_priority_ui,'category',v_category)
    );
  end if;

  v_owner := case
    when v_case.safety_risk then 'SAFETY'
    when v_case.active_trip_escalation then 'ACTIVE_TRIP_SUPPORT'
    else 'SUPPORT'
  end;

  return jsonb_build_object(
    'id',v_case.id,
    'booking_id',v_case.booking_id,
    'customer_id',v_case.customer_id,
    'partner_id',v_case.partner_id,
    'category',v_case.category,
    'priority',case v_case.priority when 'URGENT' then 'P0' when 'HIGH' then 'P1' when 'NORMAL' then 'P2' else 'P3' end,
    'status',v_case.status,
    'owner',v_owner,
    'active_trip_escalation',v_case.active_trip_escalation,
    'safety_risk',v_case.safety_risk,
    'created_at',v_case.created_at,
    'updated_at',v_case.updated_at
  );
end
$$;

revoke all on function public.open_customer_support_case(uuid,text,text,text) from public, anon;
grant execute on function public.open_customer_support_case(uuid,text,text,text) to authenticated, service_role;
